import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <div className="auth-intro">
        <p className="product-mark">Cartograph</p>
        <h1>Welcome back.</h1>
        <p>Continue to the workspace your team uses to map code structure.</p>
      </div>
      <Suspense fallback={<p>Loading sign in…</p>}>
        <SignIn forceRedirectUrl="/workspace" />
      </Suspense>
    </main>
  );
}
