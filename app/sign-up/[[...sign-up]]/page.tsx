import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <main className="auth-page">
      <div className="auth-intro">
        <p className="product-mark">Cartograph</p>
        <h1>Start with the real structure.</h1>
        <p>Create a workspace for the people who need to understand a codebase.</p>
      </div>
      <Suspense fallback={<p>Loading sign up…</p>}>
        <SignUp forceRedirectUrl="/workspace" />
      </Suspense>
    </main>
  );
}
