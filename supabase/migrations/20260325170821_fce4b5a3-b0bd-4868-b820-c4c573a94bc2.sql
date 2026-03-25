
-- Create user_roles table for admin system
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: admins can read all roles, users can read own
CREATE POLICY "Admins can read all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- Song library table
CREATE TABLE public.song_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  original_name text NOT NULL,
  mode text NOT NULL,
  file_size integer DEFAULT 0,
  storage_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.song_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own songs"
ON public.song_library FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own songs"
ON public.song_library FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own songs"
ON public.song_library FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all songs and profiles
CREATE POLICY "Admins can read all songs"
ON public.song_library FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can read all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update all profiles"
ON public.profiles FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for converted songs
INSERT INTO storage.buckets (id, name, public) VALUES ('converted-songs', 'converted-songs', false);

-- Storage RLS policies
CREATE POLICY "Users can upload own songs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'converted-songs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own songs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'converted-songs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own songs"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'converted-songs' AND (storage.foldername(name))[1] = auth.uid()::text);
