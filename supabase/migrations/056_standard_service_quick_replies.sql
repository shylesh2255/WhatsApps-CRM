INSERT INTO public.quick_replies (
  account_id, user_id, title, kind, content_text
)
SELECT a.id, a.owner_user_id, reply.title, 'text', reply.content_text
FROM public.accounts a
CROSS JOIN (VALUES
  ('Service greeting', 'Hello! Thank you for contacting our service center. How can we help you today?'),
  ('Task received', 'Your task {{1}} has been received. We will keep you updated on its progress.'),
  ('Task in progress', 'Your task {{1}} is currently in progress. We will contact you when there is an update.'),
  ('Task completed', 'Your task {{1}} is completed. Please reply with your rating from 1 to 5 and your feedback.'),
  ('Payment reminder', 'A payment of {{1}} is pending for task {{2}}. Please contact us if you need assistance.'),
  ('Feedback request', 'Please share your feedback for task {{1}}. Your rating and comments help us improve.')
) AS reply(title, content_text)
WHERE NOT EXISTS (
  SELECT 1 FROM public.quick_replies existing
  WHERE existing.account_id = a.id
    AND existing.title = reply.title
);