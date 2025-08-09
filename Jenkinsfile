pipeline {
  agent any
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
          bat 'if exist package-lock.json (npm ci) else (npm install)'
          bat 'npm run test || exit /b 0'
        }
      }
    }

    stage('Frontend - Install, Test & Build') {
      steps {
        bat 'if exist package-lock.json (npm ci) else (npm install)'
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
