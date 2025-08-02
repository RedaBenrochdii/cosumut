# Cosu-Mutuel Application - Code Structure Documentation

## Project Overview
This is a React-based application for managing mutual insurance consumption data with features for OCR scanning, data visualization, and employee management.

## Core Configuration Files

### Root Directory
- `electron.js` - Main Electron application configuration for desktop app functionality
- `vite.config.js` - Vite build tool configuration
- `eslint.config.js` - ESLint configuration for code quality
- `postcss.config.js` - PostCSS configuration for CSS processing
- `tailwind.config.js` - Tailwind CSS framework configuration
- `preload.js` - Electron preload script for IPC communication
- `package.json` - Project dependencies and scripts
- `index.html` - Main HTML entry point

### Launch Scripts
- `lancer_cosumutuel.bat` - Windows batch script to launch the application
- `lancer_cosumutuel.vbs` - VBScript wrapper for silent execution

## Source Code Structure (src/)

### Core Application Files
- `main.jsx` - Application entry point, sets up React and routing
- `App.jsx` - Root component with routing configuration
- `api.js` - API configuration for backend communication
- `index.css` - Global CSS styles
- `App.css` - App-specific CSS styles

### Components Directory (src/components/)
1. **Data Input Components**
   - `OCRScanner.jsx` - Handles OCR scanning of documents
   - `FileUploader.jsx` - Manages file uploads
   - `ExcelAutoLoader.jsx` - Handles Excel file importing
   - `ConsumptionForm.jsx` - Form for consumption data entry

2. **Data Display Components**
   - `DataTable.jsx` - Displays tabular data
   - `DailyConsumptionChart.jsx` - Charts for consumption visualization
   - `EmployeList.jsx` - Displays employee information

3. **UI Components**
   - `Sidebar.jsx` - Navigation sidebar
   - `chatbot.jsx` - AI chatbot interface

### Pages Directory (src/pages/)
- `Home.jsx` - Dashboard with charts and statistics
- `FormPage.jsx` - Main data entry form page
- `Settings.jsx` - Application settings

### Services Directory (src/services/)
- `authService.js` - Authentication service implementation

### Hooks Directory (src/hooks/)
- `useLocalStorage.js` - Custom hook for local storage management

### Styles Directory (src/styles/)
Contains modular CSS files for components:
- `DataTable.module.css`
- `ExcelAutoLoader.css`
- `FileUploader.module.css`
- `FormPage.module.css`
- `Home.module.css`
- `Settings.module.css`
- `Sidebar.module.css`

## Key Features

### 1. OCR Processing
The application includes OCR capabilities for scanning physical documents, implemented in `OCRScanner.jsx`. It uses Tesseract.js for text recognition and extracts structured data from scanned documents.

### 2. Data Visualization
The application provides data visualization through:
- Daily consumption charts (`DailyConsumptionChart.jsx`)
- Tabular data display (`DataTable.jsx`)

### 3. Employee Management
Employee data management is handled through:
- Employee listing (`EmployeList.jsx`)
- Data forms (`ConsumptionForm.jsx`)

### 4. File Management
The application supports multiple file operations:
- Excel file import/export
- File uploads
- Document scanning

### 5. Authentication
Basic authentication is implemented through `authService.js` with:
- Login/logout functionality
- Token management
- User session handling

## Technical Implementation

### State Management
- Uses React's built-in state management
- Custom hooks for local storage
- Context API for global state where needed

### Data Persistence
- Local storage for form data
- Excel file import/export capabilities
- API integration for backend communication

### UI/UX
- Responsive design with Tailwind CSS
- Modular CSS approach with CSS modules
- Modern UI components with animations

### Desktop Integration
- Electron.js integration for desktop functionality
- File system access
- Native OS features support

## Development Guidelines

1. **Styling**
   - Use CSS modules for component-specific styles
   - Follow Tailwind CSS conventions
   - Maintain consistent theming

2. **Component Structure**
   - Keep components focused and single-responsibility
   - Use proper prop validation
   - Implement error boundaries where needed

3. **Data Flow**
   - Maintain unidirectional data flow
   - Use proper state management
   - Implement proper error handling

4. **Performance**
   - Implement proper code splitting
   - Use React.memo for expensive renders
   - Optimize resource loading
