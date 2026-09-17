// Mirrors backend/app/routers/auth.py's UserOut response model.
export type UserOut = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  first_name: string | null;
  username: string | null;
  image_url: string | null;
  language: string;
  date_of_birth: string | null;
  birth_time: string | null;
  birth_place: string | null;
  timezone: string | null;
};
