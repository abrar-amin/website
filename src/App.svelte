
<script>
  import Exoplanet from './Exoplanet.svelte'
  document.title = "Abrar Amin";
</script>

<div class="stars"></div>

<div class="container">
  <div class="left-panel">
    <Exoplanet />
  </div>

  <div class="right-panel">
    <header>
      <h1>Abrar Amin</h1>
    </header>

    <main>
      <p>
        Lorem ipsum or something like that...
      </p>
    </main>
  </div>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    display: block !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  :global(#app) {
    max-width: none !important;
    margin: 0 !important;
    padding: 0 !important;
    width: 100vw;
    height: 100vh;
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

  .container {
    position: relative;
    display: flex;
    width: 100vw;
    height: 100vh;
    z-index: 1;
  }

  .left-panel {
    flex: 1;
    position: relative;
    overflow: hidden;
  }

  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 3rem;
    box-sizing: border-box;
    background-color: transparent;
  }

  header {
    margin-top: -4rem;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 4rem;
    font-weight: 700;
    margin: 0;
    background: linear-gradient(135deg, #fff 0%, #FFB380 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-shadow: 0 4px 20px rgba(255, 179, 128, 0.3);
    letter-spacing: -0.02em;
  }

  main {
    width: 100%;
  }

  p {
    font-size: 1.25rem;
    line-height: 1.8;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  @media (max-width: 768px) {
    .container {
      flex-direction: column-reverse;
    }

    .left-panel {
      height: 50vh;
    }

    .right-panel {
      padding: 2rem;
    }

    h1 {
      font-size: 2.5rem;
    }

    p {
      font-size: 1rem;
    }
  }
</style>
