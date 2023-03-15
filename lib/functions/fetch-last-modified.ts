import {
  AttributeValue,
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";
import { ScheduledHandler } from "aws-lambda";
import * as https from "https";
import invariant from "tiny-invariant";

const { AWS_REGION, TABLE_LAST_MODIFIED_NAME, TARGET_URL, TARGET_NUM_DAYS } =
  process.env;

invariant(AWS_REGION, "AWS_REGION is not set");
invariant(TABLE_LAST_MODIFIED_NAME, "TABLE_LAST_MODIFIED_NAME is not set");
invariant(TARGET_URL, "TARGET_URL is not set");
invariant(TARGET_NUM_DAYS, "TARGET_NUM_DAYS is not set");

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });

const handler: ScheduledHandler = async (event, context) => {
  // Make a request to the URL and extract the "Last-Modified" header
  const options = { method: "HEAD" };
  const lastModified = await new Promise<string>((resolve, reject) => {
    https
      .request(TARGET_URL, options, (res) => {
        invariant(res.statusCode, "Failed to fetch. No status code.");

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(
            new Error(`Failed to fetch. Status code: ${res.statusCode}`)
          );
        }

        const lastModified = res.headers["last-modified"];

        invariant(lastModified, "Failed to fetch. No header last modified.");

        resolve(lastModified);
      })
      .on("error", reject)
      .end();
  });

  const payload: Record<string, AttributeValue> = {
    url: { S: TARGET_URL },
    lastModified: { S: lastModified },
  };

  // Get date N days ago
  const daysAgo = new Date(
    Date.now() - Number(TARGET_NUM_DAYS) * 24 * 60 * 60 * 1000
  );
  const date = new Date(lastModified);

  if (date < daysAgo) {
    payload.expired = { BOOL: true };
  }

  // Save the "Last-Modified" value to DynamoDB
  const params: PutItemCommandInput = {
    TableName: TABLE_LAST_MODIFIED_NAME,
    Item: payload,
  };
  await dynamoClient.send(new PutItemCommand(params));
};

export { handler };
