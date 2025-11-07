#!/usr/bin/env node
/**
 * A simple CLI script for controlling a blue-green environment on the UpCloud load balancer.
 *
 * Requirements:
 *
 * - Load Balancer set up correctly:
 * - at least two backends, one for "blue" and one for "green"
 * - one frontend
 * - two frontend rules on the frontend for the "blue" and "green" environments, with "Use backend" action set to use the correct blue or green -backend
 *
 * Usage:
 *   $ LB_UUID=... UPCLOUD_TOKEN=... node lb.js switch prod staging
 *
 * Help:
 *   get-backend <rule-name>                       Get current backend/color of the given rule.
 *   get-color <rule-name>                         Alias for "get-backend".
 *   switch <live-rule-name> <staging-rule-name>   Switch blue-green backends.
 */

const TOKEN = process.env.UPCLOUD_TOKEN;
const LB_UUID = process.env.LB_UUID || '';
const FRONTEND_NAME = process.env.FRONTEND_NAME || 'frontend';

const DEBUG = !!process.env.DEBUG;

const RULES_URL = `/load-balancer/${LB_UUID}/frontends/${FRONTEND_NAME}/rules`;

/** do an API call */
const request = async (method, path, payload) => {
  if (!LB_UUID) {
    throw new Error('env var LB_UUID missing');
  }

  if (!TOKEN) {
    throw new Error('env var UPCLOUD_TOKEN missing');
  }

  const url = `https://api.upcloud.com/1.3${path}`;
  const response = await fetch(url, {
    ...(payload ? { body: JSON.stringify(payload) } : undefined),
    method,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

  if (DEBUG) {
    console.log(method, url, response.status);
  }

  if (response.status >= 400) {
    throw new Error(`API call failed!
  ${method} ${url}:
    ${await response.text()}`);
  }

  return response;
};

/**
 * Get frontend rule detail.
 * @param {string} ruleName Name of the frontend rule.
 * @returns {Promise<[{}, {}]>} Full rule data as an object, and the backend action.
 */
async function getRule(ruleName) {
  if (!ruleName) {
    throw new Error('Rule name missing');
  }

  const url = `${RULES_URL}/${ruleName}`;
  const rule = await request('GET', url);
  const ruleData = await rule.json();

  const ruleBackendAction = ruleData.actions.find(
    (a) => a.type === 'use_backend'
  );
  if (!ruleBackendAction) {
    throw new Error(`No backend action found for ${ruleName}`);
  }

  return [ruleData, ruleBackendAction];
}

/**
 * Get color (= backend name) of the given rule.
 *
 * @param {string} ruleName Name of the rule to check.
 * @returns {Promise<string>} Color (name of the backend) currently used for this rule, e.g. "api-green".
 */
async function getColor(ruleName) {
  const [, action] = await getRule(ruleName);
  const color = action.action_use_backend.backend;
  return color;
}

/**
 * Switch the live & staging envs! Basically, blue-green deployment.
 *
 * @param {string} liveRuleName Name of the frontend rule for the live env.
 * @param {string} stagingRuleName Frontend rule name for the staging env.
 */
async function doSwitch(liveRuleName, stagingRuleName) {
  console.log('blue-green switch initializing…');

  const [liveRuleData, liveBackendRule] = await getRule(liveRuleName);
  const [stagingRuleData, stagingBackendRule] = await getRule(stagingRuleName);

  const prevLiveBackend = liveBackendRule.action_use_backend.backend;
  const prevStagingBackend = stagingBackendRule.action_use_backend.backend;

  console.log('Current rules:');
  console.log(liveRuleName, prevLiveBackend);
  console.log(stagingRuleName, prevStagingBackend);

  // swap the data in the backend rules "in-place" (= mutate)
  liveBackendRule.action_use_backend.backend = prevStagingBackend;
  stagingBackendRule.action_use_backend.backend = prevLiveBackend;

  console.log('New rules:');
  console.log(liveRuleName, liveRuleData.actions[0].action_use_backend.backend);
  console.log(
    stagingRuleName,
    stagingRuleData.actions[0].action_use_backend.backend
  );

  console.log('======= SWITCHING! =======');

  // remove fields that are not allowed in the PUT call:
  delete liveRuleData.created_at;
  delete liveRuleData.updated_at;
  delete stagingRuleData.created_at;
  delete stagingRuleData.updated_at;

  const liveRuleUpdateResponse = await request(
    'PUT',
    `${RULES_URL}/${liveRuleName}`,
    liveRuleData
  );

  const stagingRuleUpdateResponse = await request(
    'PUT',
    `${RULES_URL}/${stagingRuleName}`,
    stagingRuleData
  );

  console.log('Ok.');

  if (DEBUG) {
    console.log(`${liveRuleName} res:`, await liveRuleUpdateResponse.json());
    console.log(
      `${stagingRuleName} res:`,
      await stagingRuleUpdateResponse.json()
    );
  }

  console.log('Confirming…');
  const newLiveColor = await getColor(liveRuleName);
  const newStagingColor = await getColor(stagingRuleName);

  if (newLiveColor === newStagingColor) {
    throw new Error(
      `FAILURE! Live and staging are using the same backend! ${newLiveColor} -- Fix this immediately manually in the hub!`
    );
  }

  if (newLiveColor !== prevStagingBackend) {
    throw new Error(
      `FAILURE! Live background was not changed, it is ${newLiveColor} when it should be ${prevStagingBackend}!`
    );
  }

  if (newStagingColor !== prevLiveBackend) {
    throw new Error(
      `FAILURE! Staging background was not changed, it is ${newStagingColor} when it should be ${prevLiveBackend}!`
    );
  }

  console.log('All ok! Switch done.');
}

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case 'get-backend':
  case 'get-color':
    if (!args[0]) {
      throw new Error('Rule name missing');
    }
    getColor(args[0])
      .then((color) => console.log(color))
      .catch((e) => {
        console.error(e);
        throw e;
      });
    break;

  case 'switch':
    if (args.length !== 2 || !args[0] || !args[1]) {
      throw new Error('Usage: switch <live-rule-name> <staging-rule-name>');
    }
    doSwitch(args[0], args[1]).catch((e) => {
      console.error(e);
      throw e;
    });
    break;

  default:
    const filename = process.argv[1].split('/').at(-1);

    console.log(`${filename}: Script for managing a blue-green env in an UpCloud Load Balancer.

  Usage:
    get-backend <rule-name>                       Get current backend/color of the given rule.
    get-color <rule-name>                         Alias for "get-backend".
    switch <live-rule-name> <staging-rule-name>   Switch blue-green backends.
`);
    break;
}
