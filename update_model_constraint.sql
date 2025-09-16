-- Update the model constraint to allow new model types
ALTER TABLE public.dumbgoodies_renders 
DROP CONSTRAINT dumbgoodies_renders_model_check;

ALTER TABLE public.dumbgoodies_renders 
ADD CONSTRAINT dumbgoodies_renders_model_check 
CHECK (model IN ('v1-seedream', 'v1_5-openai', 'v2-dalle-2', 'v2-logo-composite', 'v2-stable-diffusion-xl'));
