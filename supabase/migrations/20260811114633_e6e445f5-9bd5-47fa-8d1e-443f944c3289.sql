CREATE TABLE public.fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  crop TEXT NOT NULL DEFAULT 'corn',
  location TEXT NOT NULL,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  planting_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;

ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own fields" ON public.fields FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own fields" ON public.fields FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own fields" ON public.fields FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own fields" ON public.fields FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX fields_user_id_idx ON public.fields (user_id, created_at DESC);