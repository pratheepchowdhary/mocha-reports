// mochareports.js

'use strict';


const Base = require('mocha/lib/reporters/base');
const mochaPkg = require('mocha/package.json');
const uuid = require('uuid');
const marge = require('mochawesome-report-generator');
const margePkg = require('mochawesome-report-generator/package.json');
const conf = require('mochawesome/src/config');
const utils = require('mochawesome/src/utils');
const pkg = require('mochawesome/package.json');
const Mocha = require('mocha');
var Slack = require('node-slack');
const fs = require('fs');
const ejs = require('ejs');
var nodemailer = require('nodemailer');
var smtpTransport = require('nodemailer-smtp-transport');


const emailTemplate = ejs.compile(fs.readFileSync(`${__dirname}/src/automationReport.ejs`, 'utf8'));

// Import the utility functions
const { log, mapSuites } = utils;

// Track the total number of tests registered/skipped
const testTotals = {
  registered: 0,
  skipped: 0,
};

const {
  EVENT_SUITE_END
} = Mocha.Runner.constants;



function slackMessage(output, options) {

  var attachments = []
  var green = "#2eb886"
  var red = "#FA3107"

  var title = {
    "color": output.stats.failures > 0 ? red : green,
    "fields": [
      {
        "title": "Status",
        "value": output.stats.failures > 0 ? "Failed" : "Passed",
        "short": true
      },

      {
        "title": "Tests",
        "value": (output.stats.failures > 0 ? output.stats.failures : output.stats.passes) + " of " + output.stats.tests + (output.stats.failures > 0 ? " Failing" : " Passed"),
        "short": true
      },

      {
        "title": "Duration",
        "value": ((output.stats.duration / 1000) / 60).toFixed() + " mins",
        "short": true
      },
      {
        "title": "Environment",
        "value": options.Environment,
        "short": true
      },
      {
        "title": "Start Time",
        "value": output.stats.start,
        "short": true
      },
      {
        "title": "End Time",
        "value": output.stats.end,
        "short": true
      }


    ],
    "actions": [ 
      {
        "type": "button",
        "text": "Show Full Report",
        "style": "primary",
        "url": "#"
      }
    ]
  }
  attachments.push(title)

  for (var i = 0; i < output.results.length; i++) {
    var testCase = output.results[testCase];


  }






  // Pass in an array of menu items from data source
  return {
    "username": "Automation Reports",
    "text": "Automation Reports <!here> ", // <> are used for linking
    "icon_emoji": ":moneybag:",
    "attachments": attachments
  }
};


function sendSlackReport(output, options) {
  var slackWebHookUrl = options.hook_url
  var slack = new Slack(slackWebHookUrl);
  var payload = slackMessage(output, options)
  var result = slack.send(payload)
  console.log(result)
}

function sendMail(options, htmlFile) {
  var transporter = nodemailer.createTransport(smtpTransport({
    service: options.emailService,
    host: options.emailHost,
    auth: {
      user: options.authMail,
      pass: options.authPassword
    }
  }));

  var mailAttachFullReport = []
  if (options.mailAttachFullReport) {
    var attachment = {   // file on disk as an attachment
      filename: 'FullReport.html',
      path: htmlFile
    }
    mailAttachFullReport.push(attachment)
  }


  var data = fs.createReadStream('./emailTestReport.html');
  var mailOptions = {
    from: options.userEmail,
    to: options.toMailAdress.split("/").toString(),
    subject: options.mailSubject,
    html: data,
    attachments: mailAttachFullReport
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log('Email sent: ' + info.response);
    }
  });
}

function sendEmailReport(output, options, htmlFile) {
  try {
    fs.writeFileSync("./emailTestReport.html", emailTemplate({

      status: output.stats.failures > 0 ? "Failed" : "Passed",
      passed: (output.stats.failures > 0 ? output.stats.failures : output.stats.passes) + " of " + output.stats.tests + (output.stats.failures > 0 ? " Failing" : " Passed"),
      duration: ((output.stats.duration / 1000) / 60).toFixed() + " mins",
      environment: options.Environment,
      starttime: output.stats.start,
      endtime: output.stats.end,
      suites: output.stats.suites,
      tests: output.stats.tests,
      passed_count: output.stats.passes,
      failed: output.stats.failures
    }));


    // Returns  
    //  var emailContent= process.stdout.write(emailTemplate({
    //   status: output.stats.failures > 0 ? "Failed" : "Passed",
    //   passed: (output.stats.failures>0 ? output.stats.failures : output.stats.passes) + " of " + output.stats.tests + (output.stats.failures > 0 ? " Failing" : " Passed"),
    //   duration:((output.stats.duration / 1000) / 60).toFixed() + " mins",
    //   environment:options.Environment,
    //   starttime:output.stats.start,
    //   endtime:output.stats.end,
    //   suites:output.stats.suites,
    //   tests:output.stats.tests,
    //   passed_count:output.stats.passes,
    //   failed:output.stats.failures
    // }));

    sendMail(options, htmlFile)
  }
  catch (err) {
    console.log(err)
  }



}



/**
 * Done function gets called before mocha exits
 *
 * Creates and saves the report HTML and JSON files
 *
 * @param {Object} output    Final report object
 * @param {Object} options   Options to pass to report generator
 * @param {Object} config    Reporter config object
 * @param {Number} failures  Number of reported failures
 * @param {Function} exit
 *
 * @return {Promise} Resolves with successful report creation
 */
function done(output, options, config, failures, exit) {
  if (options.slackReport) {
    sendSlackReport(output, options)
  }

  return marge
    .create(output, options)
    .then(([htmlFile, jsonFile]) => {
      if (!htmlFile && !jsonFile) {
        log('No files were generated', 'warn', config);
      } else {
        jsonFile && log(`Report JSON saved to ${jsonFile}`, null, config);
        htmlFile && log(`Report HTML saved to ${htmlFile}`, null, config);
        if (options.emailReport) {
          sendEmailReport(output, options, htmlFile)
        }
      }
    })
    .catch(err => {
      log(err, 'error', config);
    })
    .then(() => {
      exit && exit(failures > 0 ? 1 : 0);
    });
}

/**
 * Get the class of the configured console reporter. This reporter outputs
 * test results to the console while mocha is running, and before
 * mochawesome generates its own report.
 *
 * Defaults to 'spec'.
 *
 * @param {String} reporter   Name of reporter to use for console output
 *
 * @return {Object} Reporter class object
 */
function consoleReporter(reporter) {
  if (reporter) {
    try {
      return require(`mocha/lib/reporters/${reporter}`);
    } catch (e) {
      log(`Unknown console reporter '${reporter}', defaulting to spec`);
    }
  }

  return require('mocha/lib/reporters/spec');
}

/**
 * Initialize a new reporter.
 *
 * @param {Runner} runner
 * @api public
 */
function MochaReports(runner, options) {
  // Set the config options
  this.config = conf(options);

  let passes = 0;
  let failures = 0;

  // Ensure stats collector has been initialized
  if (!runner.stats) {
    const createStatsCollector = require('mocha/lib/stats-collector');
    createStatsCollector(runner);
  }

  // Reporter options
  const reporterOptions = {
    ...options.reporterOptions,
    reportFilename: this.config.reportFilename,
    saveHtml: this.config.saveHtml,
    saveJson: this.config.saveJson,
  };

  // Done function will be called before mocha exits
  // This is where we will save JSON and generate the HTML report
  this.done = (failures, exit) =>
    done(this.output, reporterOptions, this.config, failures, exit);

  // Reset total tests counters
  testTotals.registered = 0;
  testTotals.skipped = 0;

  // Call the Base mocha reporter
  Base.call(this, runner);

  const reporterName = reporterOptions.consoleReporter;
  if (reporterName !== 'none') {
    const ConsoleReporter = consoleReporter(reporterName);
    new ConsoleReporter(runner); // eslint-disable-line
  }

  let endCalled = false;

  // Add a unique identifier to each suite/test/hook
  ['suite', 'test', 'hook', 'pending'].forEach(type => {
    runner.on(type, item => {
      item.uuid = uuid.v4();
    });
  });

  // Handle events from workers in parallel mode
  if (runner.constructor.name === 'ParallelBufferedRunner') {
    const setSuiteDefaults = suite => {
      [
        'suites',
        'tests',
        '_beforeAll',
        '_beforeEach',
        '_afterEach',
        '_afterAll',
      ].forEach(field => {
        suite[field] = suite[field] || [];
      });
      suite.suites.forEach(it => setSuiteDefaults(it));
    };

    runner.on(EVENT_SUITE_END, function (suite) {
      if (suite.root) {
        setSuiteDefaults(suite);
        runner.suite.suites.push(...suite.suites);
      }
    });
  }
  if (options.reporterOptions.slackReport) {
    runner.on("pass", function (test) {
      passes++;

    });

    runner.on("fail", function (test, err) {
      failures++;



    });
  }



  // Process the full suite
  runner.on('end', () => {
    try {
      /* istanbul ignore else */
      if (!endCalled) {
        // end gets called more than once for some reason
        // so we ensure the suite is processed only once
        endCalled = true;

        const rootSuite = mapSuites(this.runner.suite, testTotals, this.config);

        // Attempt to set a filename for the root suite to
        // support `reportFilename` [name] replacement token
        if (rootSuite) {
          if (rootSuite.suites.length === 1) {
            const firstSuite = rootSuite.suites[0];
            rootSuite.file = firstSuite.file || rootSuite.file;
            rootSuite.fullFile = firstSuite.fullFile || rootSuite.fullFile;
          } else if (!rootSuite.suites.length && rootSuite.tests.length) {
            const firstTest = this.runner.suite.tests[0];
            rootSuite.file = firstTest.file || rootSuite.file;
            rootSuite.fullFile = firstTest.fullFile || rootSuite.fullFile;
          }
        }

        const obj = {
          stats: this.stats,
          results: [rootSuite],
          meta: {
            mocha: {
              version: mochaPkg.version,
            },
            mochawesome: {
              options: this.config,
              version: pkg.version,
            },
            marge: {
              options: options.reporterOptions,
              version: margePkg.version,
            },
          },
        };

        obj.stats.testsRegistered = testTotals.registered;

        const { passes, failures, pending, tests, testsRegistered } = obj.stats;
        const passPercentage = (passes / (testsRegistered - pending)) * 100;
        const pendingPercentage = (pending / testsRegistered) * 100;

        obj.stats.passPercent = passPercentage;
        obj.stats.pendingPercent = pendingPercentage;
        obj.stats.other = passes + failures + pending - tests; // Failed hooks
        obj.stats.hasOther = obj.stats.other > 0;
        obj.stats.skipped = testTotals.skipped;
        obj.stats.hasSkipped = obj.stats.skipped > 0;
        obj.stats.failures -= obj.stats.other;

        // Save the final output to be used in the done function
        this.output = obj;
      }
    } catch (e) {
      // required because thrown errors are not handled directly in the
      // event emitter pattern and mocha does not have an "on error"
      /* istanbul ignore next */
      log(`Problem with mochawesome: ${e.stack}`, 'error');
    }
  });
}

module.exports = MochaReports;
