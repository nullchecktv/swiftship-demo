import { z } from 'zod';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';

const ses = new SESv2Client();

export const sendCustomerEmailTool = {
  isMultiTenant: false,
  name: 'sendCustomerEmail',
  description: 'Send an email to a customer',
  schema: z.object({
    subject: z.string().min(1).describe('Order ID to process refund for'),
    messageHtml: z.string().min(1).describe('Refund amount (must be positive)'),
    toEmail: z.string().min(1).describe('Reason for the refund')
  }),
  handler: async ({ subject, messageHtml, toEmail }) => {
    try {
      await ses.send(new SendEmailCommand({
        FromEmailAddress: process.env.FROM_EMAIL,
        Destination: {
          ToAddresses: [toEmail]
        },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: { Html: { Data: messageHtml } }
          }
        }
      }));

      return 'Notification sent successfully'

    } catch (error) {
      console.error(error);

      return 'Unable to send email due to an error';
    }
  }
};


