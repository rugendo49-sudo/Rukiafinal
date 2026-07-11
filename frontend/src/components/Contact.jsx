import { useState } from "react";

export default function Contact() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [msg, setMsg] = useState(null);
  const [msgType, setMsgType] = useState("info");

  function handleSubmit(e) {
    e.preventDefault();
    setMsg(null);

    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setMsgType("error");
      setMsg("Please fill in all fields");
      return;
    }

    if (!email.includes("@")) {
      setMsgType("error");
      setMsg("Please enter a valid email");
      return;
    }

    setMsgType("success");
    setMsg("Message sent! We'll get back to you within 24 hours.");
    setName("");
    setEmail("");
    setSubject("");
    setMessage("");
  }

  return (
    <div className="panel contact-panel">
      <div className="panel-header">
        <h2>Help & Support</h2>
      </div>

      <div className="contact-content">
        <section className="contact-section">
          <h3>Direct Contact</h3>
          <p>
            Email: <a href="mailto:rukia@gmail.com" className="link">rukia@gmail.com</a>
          </p>
          <p>Response time: Within 24 hours</p>
        </section>

        <section className="contact-section">
          <h3>Frequently Asked Questions</h3>
          <div className="faq-item">
            <h4>How do I verify a round's fairness?</h4>
            <p>
              Each round displays a seed hash when betting opens. After the round crashes, the server seed is revealed, allowing you to verify the hash and confirm the crash point matches the predetermined value.
            </p>
          </div>
          <div className="faq-item">
            <h4>What's the maximum multiplier?</h4>
            <p>The multiplier can theoretically reach 20,000x, but crashes occur at random intervals determined by our provably fair algorithm.</p>
          </div>
          <div className="faq-item">
            <h4>Can I deposit and withdraw at any time?</h4>
            <p>Yes. Deposits and withdrawals are processed instantly through the Wallet page. You can only withdraw up to your current balance.</p>
          </div>
          <div className="faq-item">
            <h4>Is there a minimum bet?</h4>
            <p>Yes, the minimum bet is typically KES 10. Check the betting interface for current minimums and maximums.</p>
          </div>
        </section>

        <section className="contact-section">
          <h3>Send us a message</h3>
          <form onSubmit={handleSubmit} className="contact-form">
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
            <input
              type="email"
              placeholder="Your Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="form-input"
            />
            <textarea
              placeholder="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="form-textarea"
              rows="5"
            />
            <button type="submit" className="form-submit-btn">
              Send Message
            </button>
          </form>
          {msg && <div className={`contact-msg ${msgType}`}>{msg}</div>}
        </section>
      </div>
    </div>
  );
}
