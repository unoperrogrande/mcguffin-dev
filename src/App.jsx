import "./App.css"

function Hero() {
  return (
    <section className="hero">
      <div className="hero-content">
        <p className="hero-eyebrow">Hey, I'm</p>
        <h1 className="hero-name">Danny McGuffin</h1>
        <p className="hero-tagline">
          Salesforce Engineer · Headless Explorer
        </p>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="footer">
      <p>Built with React © {new Date().getFullYear()} mcguffin.dev</p>
    </footer>
  )
}

function App() {
  return (
    <div className="app">
      <Hero />
      <Footer />
    </div>
  )
}

export default App