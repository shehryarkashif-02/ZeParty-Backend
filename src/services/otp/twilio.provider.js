/**
 * Twilio SMS Provider Adapter.
 * Dispatches transactional verification SMS via Twilio REST API.
 */
export async function sendOtp({ destination, otp, purpose, logger }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    if (logger) logger.warn('Twilio credentials not configured; simulated send');
    return {
      success: true,
      provider: 'twilio',
      status: 'SIMULATED',
      messageId: `sim_tw_${Date.now()}`,
    };
  }

  const messageBody = `Your ZeParty verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`;

  try {
    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const params = new URLSearchParams();
    params.append('To', destination);
    params.append('From', fromNumber);
    params.append('Body', messageBody);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `Twilio dispatch failed with status ${response.status}`);
    }

    return {
      success: true,
      provider: 'twilio',
      status: 'SENT',
      messageId: data.sid,
    };
  } catch (error) {
    if (logger) logger.error({ err: error, destination }, 'Twilio SMS dispatch failure');
    throw error;
  }
}

export default {
  sendOtp,
};
