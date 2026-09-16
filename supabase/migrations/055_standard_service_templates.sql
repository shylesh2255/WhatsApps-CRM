INSERT INTO public.message_templates (
  user_id, account_id, name, category, language, header_type, body_text,
  footer_text, status, sample_values
)
SELECT a.owner_user_id, a.id, template.name, 'Utility', 'en_US', 'text',
       template.body_text, 'Service Center Updates', 'DRAFT', template.sample_values::jsonb
FROM public.accounts a
CROSS JOIN (VALUES
  ('service_task_created', 'Hello {{1}}, your task {{2}} has been created with {{3}}. We will keep you updated.', '{"1":"Customer","2":"TASK-00001","3":"Service Center"}'),
  ('service_task_in_progress', 'Hello {{1}}, task {{2}} is now in progress. We will notify you when there is an update.', '{"1":"Customer","2":"TASK-00001"}'),
  ('service_task_completed', 'Hello {{1}}, task {{2}} is completed. Please reply with a rating from 1 to 5 and your feedback.', '{"1":"Customer","2":"TASK-00001"}'),
  ('service_payment_reminder', 'Hello {{1}}, payment of {{2}} is pending for task {{3}}. Please contact us if you need help.', '{"1":"Customer","2":"INR 500","3":"TASK-00001"}'),
  ('service_feedback_request', 'Hello {{1}}, please share your feedback for task {{2}}. Reply with a rating from 1 to 5 and your comments.', '{"1":"Customer","2":"TASK-00001"}')
) AS template(name, body_text, sample_values)
WHERE NOT EXISTS (
  SELECT 1 FROM public.message_templates existing
  WHERE existing.account_id = a.id
    AND existing.name = template.name
    AND existing.language = 'en_US'
);