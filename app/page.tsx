import Link from "next/link";

export default function Home() {
  return (
    <main className="welcome-page">
      <div className="welcome-copy">
        <p className="product-mark">Cartograph</p>
        <h1>Read the structure before you touch the code.</h1>
        <p>
          Cartograph turns a public repository into a map built from its real
          imports. Every map stays with the team that owns it.
        </p>
        <div className="welcome-actions">
          <Link className="button button-primary" href="/sign-up">
            Create an account
          </Link>
          <Link className="button button-secondary" href="/sign-in">
            Sign in
          </Link>
        </div>
        <p className="welcome-note">
          Public repositories only. No source code is guessed.
        </p>
      </div>
    </main>
  );
}
