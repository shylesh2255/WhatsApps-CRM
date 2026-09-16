UPDATE public.quick_replies
SET content_text = CASE title
  WHEN 'Service greeting' THEN 'Thanks for contacting us. I am checking this for you now.'
  WHEN 'Task received' THEN 'Thanks, we have received your request and will review it shortly.'
  WHEN 'Task in progress' THEN 'Our team is working on this now. We will update you soon.'
  WHEN 'Task completed' THEN 'Your request is complete. Please let us know if you need anything else.'
  WHEN 'Payment reminder' THEN 'Please share the payment reference once completed so we can update your account.'
  WHEN 'Feedback request' THEN 'We would appreciate your feedback when you have a moment. Thank you.'
  ELSE content_text
END
WHERE title IN (
  'Service greeting', 'Task received', 'Task in progress',
  'Task completed', 'Payment reminder', 'Feedback request'
);