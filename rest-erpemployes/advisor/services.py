"""The advisor agent: answers about money and clients, drafts payment reminders.

Same discipline as the legal agent (agents/services.py):
- figures come from the facts (advisor/facts.py), computed by code;
- the model call happens before anything is written, so a provider failure
  (LLMUnavailable) leaves nothing half-saved;
- cited fact numbers are checked against the facts sent;
- confidence is capped by the code: no valid citation means low confidence,
  and low confidence means a referral to a chartered accountant.
Nothing leaves the application: a reminder is a draft the founder sends.
"""

from dataclasses import asdict

from django.utils import translation
from django.utils.translation import gettext as _
from django.utils.translation import gettext_lazy
from rest_framework import status
from rest_framework.exceptions import APIException

from advisor.facts import company_facts, invoice_facts
from advisor.models import AdvisorExchange
from advisor.prompts import (
    ADVISOR_PROMPT_VERSION,
    ADVISOR_SYSTEM_PROMPT,
    REMINDER_SYSTEM_PROMPT,
    AdvisorAnswer,
    ReminderDraft,
    build_advisor_prompt,
    build_reminder_prompt,
    system_prompt,
)
from agents.llm import get_provider
from billing.models import Invoice

Confidence = AdvisorExchange.Confidence


class NothingToRemind(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = gettext_lazy("Only an issued invoice with a balance due can be reminded.")
    default_code = "nothing_to_remind"


def _cited(numbers, facts):
    """The facts behind valid numbers, once each, in the order cited."""
    return [
        {"number": number, **asdict(facts[number - 1])}
        for number in dict.fromkeys(numbers)
        if 1 <= number <= len(facts)
    ]


def ask_advisor(*, membership, question):
    user, company = membership.user, membership.company
    language = user.language
    facts = company_facts(company)

    if facts:
        provider = get_provider()
        result = provider.generate_json(
            system=system_prompt(ADVISOR_SYSTEM_PROMPT, language),
            prompt=build_advisor_prompt(question, facts),
            schema=AdvisorAnswer,
        )
        text, cited = result.answer, _cited(result.cited, facts)
        # The model's own estimate, lowered when it cites nothing we sent.
        confidence = result.confidence if cited else Confidence.LOW
        model_name, prompt_version = provider.model_name, ADVISOR_PROMPT_VERSION
    else:
        # No invoice and no client yet: no model call, nothing to ground advice on.
        with translation.override(language):
            text = _(
                "There is no data to analyse yet. Record your clients, invoices and "
                "payments in the application, then ask again."
            )
        cited, confidence, model_name, prompt_version = [], Confidence.LOW, "", ""

    return AdvisorExchange.objects.create(
        company=company,
        user=user,
        kind=AdvisorExchange.Kind.QUESTION,
        question=question,
        language=language,
        answer=text,
        confidence=confidence,
        referral=confidence == Confidence.LOW,
        cited_facts=cited,
        fact_count=len(facts),
        model_name=model_name,
        prompt_version=prompt_version,
    )


def draft_payment_reminder(*, membership, invoice, channel, tone):
    """A reminder for an unpaid invoice, for the founder to review and send."""
    if invoice.status != Invoice.Status.ISSUED or invoice.balance_due <= 0:
        raise NothingToRemind()

    user, company = membership.user, membership.company
    language = user.language
    facts = invoice_facts(invoice)
    provider = get_provider()
    result = provider.generate_json(
        system=system_prompt(REMINDER_SYSTEM_PROMPT, language),
        prompt=build_reminder_prompt(facts, channel=channel, tone=tone),
        schema=ReminderDraft,
    )
    message = result.message.strip()
    # The reference the client needs to pay: never left to the model's goodwill.
    if invoice.number not in message:
        message = f"{message}\n\n{invoice.number}"

    return AdvisorExchange.objects.create(
        company=company,
        user=user,
        kind=AdvisorExchange.Kind.REMINDER,
        question=f"{channel} / {tone}",
        invoice=invoice,
        language=language,
        subject=result.subject.strip() if channel == "email" else "",
        answer=message,
        confidence=Confidence.HIGH,
        cited_facts=_cited(result.cited, facts),
        fact_count=len(facts),
        model_name=provider.model_name,
        prompt_version=ADVISOR_PROMPT_VERSION,
    )
