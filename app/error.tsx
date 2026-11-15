'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="standalone card">
      <h1>Something interrupted this page.</h1>
      <p>Your saved responses are retained. You can try loading the page again.</p>
      <button onClick={reset}>Try again</button>
      <p>
        If you want to stop, close the page. Contact the study team through your invitation for
        help.
      </p>
    </main>
  );
}
