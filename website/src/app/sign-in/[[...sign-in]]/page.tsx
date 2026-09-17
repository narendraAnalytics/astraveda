import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0E0B1E] py-16 px-4">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: "#8F29DD",
            colorBackground: "#17132B",
            colorForeground: "#FFF7E6",
            colorInputForeground: "#FFF7E6",
          },
        }}
      />
    </main>
  );
}
