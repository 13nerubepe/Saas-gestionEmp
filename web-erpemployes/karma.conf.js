// Karma for `ng test`. Same as Angular's default, plus a headless Chrome that
// runs without the sandbox: CI runners (and containers) cannot create one.
module.exports = function (config) {
    config.set({
        basePath: '',
        frameworks: ['jasmine', '@angular-devkit/build-angular'],
        plugins: [require('karma-jasmine'), require('karma-chrome-launcher'), require('karma-jasmine-html-reporter'), require('karma-coverage'), require('@angular-devkit/build-angular/plugins/karma')],
        client: { jasmine: {}, clearContext: false },
        jasmineHtmlReporter: { suppressAll: true },
        coverageReporter: { dir: require('path').join(__dirname, './coverage'), subdir: '.', reporters: [{ type: 'html' }, { type: 'text-summary' }] },
        reporters: ['progress', 'kjhtml'],
        browsers: ['Chrome'],
        customLaunchers: {
            ChromeHeadlessCI: { base: 'ChromeHeadless', flags: ['--no-sandbox'] }
        },
        restartOnFileChange: true
    });
};
