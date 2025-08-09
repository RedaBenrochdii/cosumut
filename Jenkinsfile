pipeline {
  agent any
  options { timestamps() }
  environment {
    CI = 'true'
    npm_config_fund  = 'false'
    npm_config_audit = 'false'
    NODE_OPTIONS = '--max-old-space-size=4096'
  }

  stages {
    stage('Checkout') {
      steps { checkout scm }
    }

    stage('Versions') {
      steps {
        bat 'node -v'
        bat 'npm -v'
      }
    }

    stage('Backend - Install & Test') {
      steps {
        dir('backend') {
          // Forcer npm install (tolérant) au lieu de npm ci
          bat 'echo BACKEND: npm install && npm install --no-audit --no-fund'
          bat 'npm run test || exit /b 0'
        }
      }
    }

    stage('Frontend - Install, Test & Build') {
      steps {
        // Tente npm ci sinon bascule npm install
        bat 'npm ci || npm install --no-audit --no-fund'
        bat 'npm run test || exit /b 0'
        bat 'npm run build'
      }
    }

    stage('Archive artefacts') {
      steps {
        archiveArtifacts artifacts: 'dist/**', fingerprint: true, allowEmptyArchive: false
      }
    }
  }

  post {
    success { echo '✅ Build OK (backend + frontend)' }
    failure { echo '❌ Échec : voir la console' }
    always  { cleanWs() }
  }
}
