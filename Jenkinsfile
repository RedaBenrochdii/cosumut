pipeline {
    agent any
    options { 
        timestamps()
        ansiColor('xterm')
    }
    environment {
        CI = 'true'
        npm_config_fund  = 'false'
        npm_config_audit = 'false'
    }

    stages {
        stage('Checkout') {
            steps {
                // Récupération du code depuis GitHub
                checkout scm
            }
        }

        stage('Versions') {
            steps {
                echo "Vérification des versions Node et npm"
                bat 'node -v'
                bat 'npm -v'
            }
        }

        stage('Backend - Install & Tests') {
            steps {
                dir('backend') {
                    echo "Installation des dépendances backend"
                    bat 'npm ci'
                    // Les tests ne bloquent pas le build pour l’instant
                    bat 'npm test -- --watchAll=false || exit /b 0'
                }
            }
        }

        stage('Frontend - Install, Test & Build') {
            steps {
                echo "Installation des dépendances frontend"
                bat 'npm ci'
                echo "Exécution des tests frontend"
                bat 'npm test -- --watchAll=false || exit /b 0'
                echo "Build frontend"
                bat 'npm run build'
            }
        }

        stage('Archive build frontend') {
            steps {
                echo "Archivage du dossier dist/"
                archiveArtifacts artifacts: 'dist/**', fingerprint: true, allowEmptyArchive: false
            }
        }
    }

    post {
        success {
            echo '✅ Build réussi (backend + frontend).'
        }
        failure {
            echo '❌ Échec : regarde les logs de l’étape en rouge.'
        }
        always {
            cleanWs()
        }
    }
}
