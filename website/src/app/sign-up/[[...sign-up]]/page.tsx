import { SignUp } from "@clerk/nextjs";
import AuthStage from "@/components/auth/AuthStage";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignUpPage() {
  return (
    <AuthStage mode="sign-up">
      <SignUp appearance={clerkAppearance} />
    </AuthStage>
  );
}
