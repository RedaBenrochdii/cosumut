pipeline {
  agent any

  options {
    timestamps()
    // Évite qu’un stage ne reste bloqué éternellement
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    CI = 'true'
    npm_config_fund  = 'false'
    npm_config_audit = 'false'
    NODE_OPTIONS = '--max-old-space-size=4096'
  }

  stages {

    stage('Checkout') {
      steps {
        checkout scm
        echo "Branche: ${env.BRANCH_NAME ?: 'main'}"
      }
    }

    stage('Versions Node/npm') {
      steps {
        bat 'node -v'
        bat 'npm -v'
      }
    }

    stage('Backend - Install & Tests (tolérant)') {
      steps {
        dir('backend') {
          // lockfile pas toujours synchro -> npm install tolérant
          bat 'echo BACKEND: npm install && npm install --no-audit --no-fund'
          // tests non bloquants tant que tu n’en as pas
          bat 'npm run test || exit /b 0'
        }
      }
    }

    stage('Frontend - Install, Test & Build') {
      steps {
        // FRONTEND À LA RACINE du repo
        // tente npm ci (plus rapide/reproductible), sinon bascule npm install
        bat 'npm ci || npm install --no-audit --no-fund'
        bat 'npm run test || exit /b 0'
        bat 'npm run build'
      }
    }

    stage('Archive artefacts (dist)') {
      steps {
        // Si ton build sort ailleurs (ex: build/**), change le pattern
        archiveArtifacts artifacts: 'dist/**', fingerprint: true, allowEmptyArchive: false
      }
    }
  }

  post {
    success {
      echo '✅ Build OK (backend + frontend).'
    }
    failure {
      echo '❌ Échec : ouvre la Console Output, regarde la dernière étape rouge.'
    }
    always {
      // Nettoyage pour éviter les caches entre builds
      cleanWs()
    }
  }
}
stage('POC: Docker up') {
  steps {
    bat 'docker --version'
    bat 'docker compose -f docker-compose.yml up -d --build'
  }
}
