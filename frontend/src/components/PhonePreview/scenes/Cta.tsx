import KineticReveal from "../KineticReveal";

export default function Cta() {
  return (
    <>
      <div className="phone-author">/ next</div>
      <div style={{ marginTop: "auto", marginBottom: 20 }}>
        <div style={{
          fontWeight: 800, fontSize: 26, lineHeight: 1.05,
          letterSpacing: "-0.02em",
        }}>
          <KineticReveal text="Save this · share it · steal it." />
        </div>
        <div className="phone-cta" style={{ marginTop: 14 }}>
          <i /> by reelify.agent
        </div>
      </div>
    </>
  );
}
