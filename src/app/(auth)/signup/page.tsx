import { Suspense } from "react";
import { AuthForm } from "@/components/features/auth-form";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="signup" />
    </Suspense>
  );
}
