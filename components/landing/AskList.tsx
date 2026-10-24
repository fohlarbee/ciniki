"use client";

import { useState } from "react";
import Ticket from "../Ticket";
import { EXAMPLES } from "./examples";

/** Pick a request on the left; the ticket it produces prints on the right. */
export default function AskList() {
  const [id, setId] = useState(EXAMPLES[0].id);
  const ex = EXAMPLES.find((e) => e.id === id) ?? EXAMPLES[0];
  return (
    <div className="ask-grid">
      <ul className="ask-list" role="list">
        {EXAMPLES.map((e) => (
          <li key={e.id}>
            <button type="button" aria-pressed={e.id === id} className={e.id === id ? "on" : ""} onClick={() => setId(e.id)}>
              <span className="ask-group">{e.group}</span>
              <span className="ask-prompt">“{e.prompt}”</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="ask-ticket">
        <Ticket
          key={ex.id}
          kind={ex.kind}
          title={ex.title}
          lines={ex.lines}
          checks={ex.checks}
          expiryLabel={ex.expiry}
          printing
          footer={
            ex.infoOnly ? (
              <span className="info-only">Information only. Nothing to sign.</span>
            ) : (
              <>
                <span className="btn btn-signal btn-lg" aria-hidden="true">
                  Approve in wallet
                </span>
                <span className="btn btn-ghost btn-lg" aria-hidden="true">
                  Dismiss
                </span>
              </>
            )
          }
        />
        <p className="demo-caption">Example values. Real tickets use live prices.</p>
      </div>
    </div>
  );
}
