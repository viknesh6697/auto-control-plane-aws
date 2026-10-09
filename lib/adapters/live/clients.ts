import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EC2Client } from "@aws-sdk/client-ec2";
import { IAMClient } from "@aws-sdk/client-iam";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { getLiveAwsConfig } from "@/lib/config";

function region() {
  return getLiveAwsConfig().region || "us-east-1";
}

function credentials() {
  return defaultProvider();
}

export function getDynamoDocClient() {
  const client = new DynamoDBClient({
    region: region(),
    credentials: credentials(),
  });
  return DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });
}

export function getEc2Client() {
  return new EC2Client({ region: region(), credentials: credentials() });
}

export function getIamClient() {
  return new IAMClient({ region: region(), credentials: credentials() });
}

export function getEventBridgeClient() {
  return new EventBridgeClient({
    region: region(),
    credentials: credentials(),
  });
}
