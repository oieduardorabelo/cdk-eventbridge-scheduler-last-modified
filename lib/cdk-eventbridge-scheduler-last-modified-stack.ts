import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import invariant from "tiny-invariant";

const { TARGET_NUM_DAYS = "30", TARGET_URL } = process.env;

export class SchedulerLastModifiedStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a DynamoDB table
    const lastModifiedTable = new cdk.aws_dynamodb.Table(
      this,
      "LastModifiedTable",
      {
        partitionKey: {
          name: "url",
          type: cdk.aws_dynamodb.AttributeType.STRING,
        },
        removalPolicy: cdk.RemovalPolicy.DESTROY,
      }
    );

    invariant(TARGET_URL, "TARGET_URL is required");

    // Create a Lambda function
    const fetchLastModifiedLambda = new cdk.aws_lambda_nodejs.NodejsFunction(
      this,
      "FetchLastModifiedLambda",
      {
        runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
        entry: path.join(__dirname, "functions/fetch-last-modified.ts"),
        environment: {
          TABLE_LAST_MODIFIED_NAME: lastModifiedTable.tableName,
          TARGET_NUM_DAYS,
          TARGET_URL,
        },
      }
    );

    // Add permissions to the Lambda function to read/write from the DynamoDB table
    lastModifiedTable.grantReadWriteData(fetchLastModifiedLambda);

    // Create an EventBridge rule to trigger the Lambda function every Friday
    const fridayRule = new cdk.aws_events.Rule(this, "FridayRule", {
      schedule: cdk.aws_events.Schedule.cron({
        minute: "0",
        hour: "7",
        weekDay: "FRI",
      }), // Runs at 07am UTC every Friday
      enabled: true,
    });

    // Add the Lambda function as a target of the EventBridge rule
    fridayRule.addTarget(
      new cdk.aws_events_targets.LambdaFunction(fetchLastModifiedLambda)
    );

    // Output the table name
    new cdk.CfnOutput(this, "LastModifiedTableName", {
      value: lastModifiedTable.tableName,
    });
  }
}
