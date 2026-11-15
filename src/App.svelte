
<script>
  import Exoplanet from './Exoplanet.svelte'
  import TransitCurve from './TransitCurve.svelte'
  document.title = "Abrar Amin";
</script>

<div class="stars"></div>

<div class="page">
  <div class="content">
    <header>
      <h2>Abrar Amin</h2>
    </header>

    <main>
        <p>
        </p>
    </main>
  </div>

  <section class="hero">
    <div class="planet">
      <Exoplanet />
    </div>
    <div class="transit">
      <TransitCurve />
    </div>
  </section>
</div>

<style>

  :global(body) {
    margin: 0;
    padding: 0;
    display: block !important;
    font-family: 'Geist Mono', ui-monospace, Menlo, monospace;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(#app) {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100%;
  }

  .stars {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    background: #000000;
  }

  .stars::before,
  .stars::after {
    content: '';
    position: absolute;
    width: 1px;
    height: 1px;
    background: transparent;
    border-radius: 50%;
    box-shadow:
      100px 200px #fff, 300px 150px #fff, 500px 400px #fff,
      800px 300px #fff, 1200px 500px #fff, 200px 600px #fff,
      400px 100px #fff, 700px 250px #fff, 900px 450px #fff,
      1100px 150px #fff, 150px 400px #fff, 350px 550px #fff,
      600px 200px #fff, 1000px 350px #fff, 250px 500px #fff,
      450px 300px #fff, 750px 450px #fff, 950px 250px #fff,
      50px 350px #fff, 550px 500px #fff, 850px 150px #fff,
      1150px 400px #fff, 300px 450px #fff, 650px 350px #fff,
      180px 280px #fff, 480px 180px #fff, 780px 380px #fff,
      1080px 280px #fff, 120px 520px #fff, 420px 420px #fff,
      720px 220px #fff, 1020px 520px #fff, 220px 320px #fff,
      520px 120px #fff, 820px 420px #fff, 1120px 220px #fff,
      80px 180px #fff, 380px 280px #fff, 680px 480px #fff,
      980px 380px #fff, 140px 140px #fff, 440px 340px #fff,
      740px 540px #fff, 1040px 440px #fff, 260px 240px #fff,
      560px 340px #fff, 860px 540px #fff, 1160px 340px #fff,
      90px 450px #fff, 390px 550px #fff, 690px 150px #fff,
      990px 450px #fff, 1290px 250px #fff, 190px 350px #fff,
      1400px 200px #fff, 1500px 400px #fff, 1600px 300px #fff,
      1700px 500px #fff, 1800px 150px #fff, 1900px 350px #fff,
      30px 100px #fff, 130px 300px #fff, 230px 500px #fff,
      330px 200px #fff, 430px 400px #fff, 530px 600px #fff,
      60px 250px #fff, 160px 450px #fff, 260px 150px #fff,
      360px 350px #fff, 460px 550px #fff, 560px 250px #fff;
  }

  .stars::after {
    box-shadow:
      150px 250px #fff, 350px 200px #fff, 550px 450px #fff,
      850px 350px #fff, 1250px 550px #fff, 250px 650px #fff,
      450px 150px #fff, 750px 300px #fff, 950px 500px #fff,
      1150px 200px #fff, 200px 450px #fff, 400px 600px #fff,
      650px 250px #fff, 1050px 400px #fff, 300px 550px #fff,
      500px 350px #fff, 800px 500px #fff, 1000px 300px #fff,
      100px 400px #fff, 600px 550px #fff, 900px 200px #fff,
      1200px 450px #fff, 350px 500px #fff, 700px 400px #fff,
      230px 330px #fff, 530px 230px #fff, 830px 430px #fff,
      1130px 330px #fff, 170px 570px #fff, 470px 470px #fff,
      770px 270px #fff, 1070px 570px #fff, 270px 370px #fff,
      570px 170px #fff, 870px 470px #fff, 1170px 270px #fff,
      130px 230px #fff, 430px 330px #fff, 730px 530px #fff,
      1030px 430px #fff, 190px 190px #fff, 490px 390px #fff,
      790px 590px #fff, 1090px 490px #fff, 310px 290px #fff,
      610px 390px #fff, 910px 590px #fff, 1210px 390px #fff,
      140px 500px #fff, 440px 600px #fff, 740px 200px #fff,
      1040px 500px #fff, 1340px 300px #fff, 240px 400px #fff,
      1450px 250px #fff, 1550px 450px #fff, 1650px 350px #fff,
      1750px 550px #fff, 1850px 200px #fff, 1950px 400px #fff,
      40px 120px #fff, 140px 320px #fff, 240px 520px #fff,
      340px 220px #fff, 440px 420px #fff, 540px 620px #fff,
      70px 270px #fff, 170px 470px #fff, 270px 170px #fff,
      370px 370px #fff, 470px 570px #fff, 570px 270px #fff;
  }

  .page {
    position: relative;
    z-index: 1;
  }

  /* Planet section below the text; part of the normal page flow */
  .hero {
    position: relative;
  }

  .planet {
    height: 75vh;
    overflow: hidden;
  }

  /* Light curve sits in the empty right half, beside the planet */
  .transit {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    font-size: 14px;
  }

  .content {
    max-width: 65ch;
    margin: 0 auto;
    padding: 3rem 2rem 6rem;
    box-sizing: border-box;
  }

  header {
    margin-bottom: 2rem;
    padding-top: 1rem;
  }

  h1 {
    font-size: 4rem;
    font-weight: 700;
    margin: 0;
    color: #fff;
    letter-spacing: -0.02em;
  }

  main {
    width: 100%;
  }

  .category {
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid rgba(255, 179, 128, 0.1);
  }

  .category:last-child {
    border-bottom: none;
  }

  h2 {
    font-size: 1.75rem;
    font-weight: 600;
    margin: 0 0 1rem 0;
    color: #fff;
    position: relative;
    display: inline-block;
  }


  p {
    font-size: 1.1rem;
    font-weight: 600;
    line-height: 1.8;
    color: #fff;
    margin: 0;
  }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .project-card {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 179, 128, 0.15);
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.3s ease;
    text-decoration: none;
    display: block;
  }

  .project-card:hover {
    background: rgba(255, 179, 128, 0.08);
    border-color: rgba(255, 179, 128, 0.3);
    transform: translateY(-2px);
  }

  .project-card h3 {
    font-size: 1.1rem;
    font-weight: 600;
    margin: 0 0 0.5rem 0;
    color: #FFB380;
  }

  .project-card p {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.7);
    margin: 0;
    line-height: 1.5;
  }

  .skills-container {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-top: 1rem;
  }

  .skill-tag {
    background: rgba(255, 179, 128, 0.1);
    border: 1px solid rgba(255, 179, 128, 0.2);
    color: rgba(255, 255, 255, 0.9);
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    transition: all 0.3s ease;
  }

  .skill-tag:hover {
    background: rgba(255, 179, 128, 0.18);
    border-color: rgba(255, 179, 128, 0.4);
  }

  .contact-links {
    display: flex;
    gap: 1rem;
    margin-top: 1rem;
  }

  .contact-link {
    background: transparent;
    border: 1px solid rgba(255, 179, 128, 0.3);
    color: #FFB380;
    padding: 0.6rem 1.5rem;
    border-radius: 8px;
    font-size: 0.95rem;
    text-decoration: none;
    transition: all 0.3s ease;
    font-weight: 500;
  }

  .contact-link:hover {
    background: rgba(255, 179, 128, 0.15);
    border-color: #FFB380;
  }

  @media (max-width: 768px) {
    .planet {
      height: 55vh;
    }

    /* Phones: planet is centered, so the curve goes underneath it.
       60 braille cells wide, each ~0.6em. */
    .transit {
      position: static;
      transform: none;
      padding: 1rem 1.5rem 3rem;
      font-size: min(14px, calc((100vw - 3rem) / 60 / 0.6));
    }

    .content {
      padding: 2rem 1.5rem 4rem;
    }

    header {
      margin-bottom: 1.5rem;
    }

    nav {
      flex-wrap: wrap;
      gap: 1rem;
    }

    h1 {
      font-size: 2.5rem;
    }

    h2 {
      font-size: 1.4rem;
    }

    p {
      font-size: 1rem;
    }

    .project-grid {
      grid-template-columns: 1fr;
    }

    .contact-links {
      flex-wrap: wrap;
    }
  }
</style>
