import * as cdk from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";

process.env.TARGET_URL = "my-uni-test-url";

import { SchedulerLastModifiedStack } from "../lib/cdk-eventbridge-scheduler-last-modified-stack";

test("creates a rule that runs on a schedule every Friday at 07:00 am", () => {
  const app = new cdk.App();
  const stack = new SchedulerLastModifiedStack(app, "MyTestStack");
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::Events::Rule", {
    ScheduleExpression: "cron(0 7 ? * FRI *)",
    State: "ENABLED",
  });
});

test("creates a rule with lambda function as target", () => {
  const app = new cdk.App();
  const stack = new SchedulerLastModifiedStack(app, "MyTestStack");
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::Events::Rule", {
    Targets: [
      {
        Arn: Match.objectLike({
          "Fn::GetAtt": [
            Match.stringLikeRegexp("FetchLastModifiedLambda"),
            "Arn",
          ],
        }),
        Id: Match.stringLikeRegexp("Target"),
      },
    ],
  });
});

test("creates last modified table in DynamoDB", () => {
  const app = new cdk.App();
  const stack = new SchedulerLastModifiedStack(app, "MyTestStack");
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::DynamoDB::Table", {
    KeySchema: [{ AttributeName: "url", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "url", AttributeType: "S" }],
  });
});

test("creates correct permissions for lambda to read/write to DynamoDB", () => {
  const app = new cdk.App();
  const stack = new SchedulerLastModifiedStack(app, "MyTestStack");
  const template = Template.fromStack(stack);
  template.hasResourceProperties("AWS::IAM::Policy", {
    PolicyName: Match.stringLikeRegexp("FetchLastModifiedLambda"),
    PolicyDocument: {
      Statement: [
        {
          Action: Match.arrayWith(["dynamodb:GetItem", "dynamodb:PutItem"]),
        },
      ],
    },
  });
});
