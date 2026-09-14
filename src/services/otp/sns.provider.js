/**
 * AWS SNS SMS Provider Adapter.
 * Dispatches transactional verification SMS via AWS SNS.
 */
export async function sendOtp({ destination, otp, purpose, logger }) {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!accessKeyId || !secretAccessKey) {
    if (logger) logger.warn('AWS credentials not configured; simulated send');
    return {
      success: true,
      provider: 'aws_sns',
      status: 'SIMULATED',
      messageId: `sim_sns_${Date.now()}`,
    };
  }

  const messageBody = `Your ZeParty verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

  try {
    const { SNSClient, PublishCommand } = await import('@aws-sdk/client-sns');
    const snsClient = new SNSClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new PublishCommand({
      PhoneNumber: destination,
      Message: messageBody,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      },
    });

    const response = await snsClient.send(command);

    return {
      success: true,
      provider: 'aws_sns',
      status: 'SENT',
      messageId: response.MessageId,
    };
  } catch (error) {
    if (logger) logger.error({ err: error, destination }, 'AWS SNS dispatch failure');
    throw error;
  }
}

export default {
  sendOtp,
};
