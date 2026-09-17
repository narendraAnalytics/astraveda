import { SignIn } from "@clerk/nextjs";
import AuthStage from "@/components/auth/AuthStage";
import { clerkAppearance } from "@/lib/clerk-appearance";

export default function SignInPage() {
  return (
    <AuthStage mode="sign-in">
      <SignIn appearance={clerkAppearance} />
    </AuthStage>
  );
}
