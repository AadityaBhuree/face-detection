export type SupportedLocale = 'en' | 'hi' | 'mr' | 'es';

export interface Translations {
  // App-level
  appName: string;
  brandTagline: string;

  // Navigation
  intakeSession: string;
  unknownPatient: string;
  dashboard: string;
  back: string;
  cancel: string;
  continue_: string;
  confirm: string;

  // Camera
  startCamera: string;
  stopCamera: string;
  switchToRear: string;
  switchToFront: string;
  detectingCameras: string;
  frontCamera: string;
  rearCamera: string;
  camerasAvailable: string;
  cameraNotStarted: string;
  waitingForCamera: string;

  // Face Detection
  detecting: string;
  positionFace: string;
  confidencePercent: string;
  livenessCheck: string;
  blinksNeeded: string;
  blinkDetected: string;
  faceMatched: string;
  searchingIdentity: string;
  patientIdentified: string;
  newPatientRegistration: string;
  noMatchFound: string;

  // Intake Conversation
  aiVoiceIntake: string;
  inConversation: string;
  allInfoGathered: string;
  thinking: string;
  typeResponse: string;
  listening: string;
  startIntake: string;
  readyToBegin: string;
  intakeDesc: string;
  completeIntake: string;
  generateBrief: string;
  intakeComplete: string;
  briefGenerated: string;
  conversationError: string;
  tryAgain: string;

  // Clinical Brief
  clinicalBrief: string;
  summary: string;
  chiefComplaint: string;
  riskFlags: string;
  vitalsToCheck: string;
  icd10: string;
  medicationsNote: string;
  suggestedFollowups: string;
  markReviewed: string;
  edit: string;
  export_: string;
  loading: string;
  readyForDoctor: string;

  // Registration
  whatIsYourName: string;
  patientDetails: string;
  reviewConsent: string;
  fullName: string;
  dateOfBirth: string;
  mobileNumber: string;
  namePlaceholder: string;
  mobilePlaceholder: string;
  consentText: string;
  consentDetail: string;
  registerPatient: string;
  welcomeMessage: string;
  redirecting: string;
  preparingIntake: string;

  // Language
  selectLanguage: string;
  language: string;

  // Errors
  nameRequired: string;
  nameTooShort: string;
  dobRequired: string;
  ageInvalid: string;
  mobileInvalid: string;
  consentRequired: string;
  noFaceData: string;
  livenessRequired: string;
  registrationFailed: string;
  cameraError: string;
  cameraNotSupported: string;
  identitySearchFailed: string;
  faceNotLoaded: string;
  aiThinking: string;
}

type DeepTranslations = Record<SupportedLocale, Translations>;

export const translations: DeepTranslations = {
  en: {
    appName: 'AyuTalk Care',
    brandTagline: 'AI-Powered Clinic Intake System',
    intakeSession: 'Intake Session',
    unknownPatient: 'Unknown Patient',
    dashboard: 'Dashboard',
    back: 'Back',
    cancel: 'Cancel',
    continue_: 'Continue',
    confirm: 'Confirm',
    startCamera: 'Start Camera',
    stopCamera: 'Stop Camera',
    switchToRear: 'Switch to rear camera',
    switchToFront: 'Switch to front camera',
    detectingCameras: 'Detecting cameras...',
    frontCamera: 'Front',
    rearCamera: 'Rear',
    camerasAvailable: '{count} camera{plural} available',
    cameraNotStarted: 'Camera not started',
    waitingForCamera: 'Waiting for camera...',
    detecting: 'Detecting Face',
    positionFace: 'Position your face in the center',
    confidencePercent: '{percent}% confidence',
    livenessCheck: 'Liveness check',
    blinksNeeded: 'Please blink naturally ({remaining} blinks needed)',
    blinkDetected: 'Blink detected!',
    faceMatched: 'Face Matched — {percent}%',
    searchingIdentity: 'Searching identity...',
    patientIdentified: 'Patient Identified',
    newPatientRegistration: 'New Patient Registration',
    noMatchFound: 'New patient — registration required',
    aiVoiceIntake: 'AI Voice Intake',
    inConversation: 'In conversation',
    allInfoGathered: 'All info gathered',
    thinking: 'Thinking',
    typeResponse: 'Type your response or tap the mic...',
    listening: 'Listening...',
    startIntake: 'Start AI Intake',
    readyToBegin: 'Ready to begin the intake conversation',
    intakeDesc: 'The AI assistant will ask about symptoms, duration, and medical history',
    completeIntake: 'Complete Intake & Generate Brief',
    generateBrief: 'Generating Brief',
    intakeComplete: 'Intake Complete',
    briefGenerated: 'The clinical brief is ready for the doctor.',
    conversationError: 'Conversation Error',
    tryAgain: 'Sorry, I encountered an error. Please try again.',
    clinicalBrief: 'Clinical Intake Brief',
    summary: 'Summary',
    chiefComplaint: 'Chief Complaint',
    riskFlags: 'Risk Flags',
    vitalsToCheck: 'Vitals to Check',
    icd10: 'ICD-10 Hints',
    medicationsNote: 'Medications Note',
    suggestedFollowups: 'Suggested Follow-ups for Doctor',
    markReviewed: 'Mark as Reviewed',
    edit: 'Edit',
    export_: 'Export',
    loading: 'Loading...',
    readyForDoctor: 'Ready for doctor review',
    whatIsYourName: 'What is your name?',
    patientDetails: 'Patient Details',
    reviewConsent: 'Review & Consent',
    fullName: 'Full Name',
    dateOfBirth: 'Date of Birth',
    mobileNumber: 'Mobile Number',
    namePlaceholder: 'e.g., Priya Sharma',
    mobilePlaceholder: '+919876543210',
    consentText: 'I give my consent',
    consentDetail: 'I authorize the capture and storage of my facial data for identification purposes during clinic visits.',
    registerPatient: 'Confirm & Register',
    welcomeMessage: 'Welcome, {name}!',
    redirecting: 'Patient registered successfully. Redirecting to intake...',
    preparingIntake: 'Preparing AI intake conversation...',
    selectLanguage: 'Select Language',
    language: 'Language',
    nameRequired: 'Patient name is required',
    nameTooShort: 'Name must be at least 2 characters',
    dobRequired: 'Date of birth is required',
    ageInvalid: 'Patient age must be between 0 and 120 years',
    mobileInvalid: 'Enter a valid mobile number (e.g., +919876543210)',
    consentRequired: 'Patient consent is required to store facial data',
    noFaceData: 'No face data captured. Please try again.',
    livenessRequired: 'Liveness check not passed. Please complete the blink challenge.',
    registrationFailed: 'Registration failed',
    cameraError: 'Failed to access camera',
    cameraNotSupported: 'Camera access not supported in this browser',
    identitySearchFailed: 'Face identification failed. Please try again.',
    faceNotLoaded: 'Face detection model not loaded yet. Please wait.',
    aiThinking: 'AI is thinking...',
  },

  hi: {
    appName: 'आयुरटॉक केयर',
    brandTagline: 'एआई-संचालित क्लिनिक इंटेक सिस्टम',
    intakeSession: 'इंटेक सत्र',
    unknownPatient: 'अज्ञात रोगी',
    dashboard: 'डैशबोर्ड',
    back: 'वापस',
    cancel: 'रद्द करें',
    continue_: 'जारी रखें',
    confirm: 'पुष्टि करें',
    startCamera: 'कैमरा शुरू करें',
    stopCamera: 'कैमरा बंद करें',
    switchToRear: 'रियर कैमरा पर स्विच करें',
    switchToFront: 'फ्रंट कैमरा पर स्विच करें',
    detectingCameras: 'कैमरा पहचान रहे हैं...',
    frontCamera: 'फ्रंट',
    rearCamera: 'रियर',
    camerasAvailable: '{count} कैमरा{plural} उपलब्ध',
    cameraNotStarted: 'कैमरा शुरू नहीं हुआ',
    waitingForCamera: 'कैमरे की प्रतीक्षा...',
    detecting: 'चेहरा पहचान रहे हैं',
    positionFace: 'अपना चेहरा केंद्र में रखें',
    confidencePercent: '{percent}% विश्वास',
    livenessCheck: 'जीवितता जांच',
    blinksNeeded: 'कृपया प्राकृतिक रूप से पलक झपकाएं ({remaining} पलकें आवश्यक)',
    blinkDetected: 'पलक झपकी का पता चला!',
    faceMatched: 'चेहरा मिला — {percent}%',
    searchingIdentity: 'पहचान खोज रहे हैं...',
    patientIdentified: 'रोगी की पहचान हुई',
    newPatientRegistration: 'नया रोगी पंजीकरण',
    noMatchFound: 'नए रोगी — पंजीकरण आवश्यक',
    aiVoiceIntake: 'एआई वॉइस इंटेक',
    inConversation: 'बातचीत में',
    allInfoGathered: 'सारी जानकारी एकत्र',
    thinking: 'सोच रहे हैं',
    typeResponse: 'अपना उत्तर टाइप करें या माइक टैप करें...',
    listening: 'सुन रहे हैं...',
    startIntake: 'एआई इंटेक शुरू करें',
    readyToBegin: 'इंटेक वार्तालाप शुरू करने के लिए तैयार',
    intakeDesc: 'एआई सहायक लक्षणों, अवधि और चिकित्सा इतिहास के बारे में पूछेगा',
    completeIntake: 'इंटेक पूरा करें और ब्रीफ जनरेट करें',
    generateBrief: 'ब्रीफ जनरेट कर रहे हैं',
    intakeComplete: 'इंटेक पूर्ण',
    briefGenerated: 'क्लिनिकल ब्रीफ डॉक्टर के लिए तैयार है।',
    conversationError: 'वार्तालाप त्रुटि',
    tryAgain: 'क्षमा करें, एक त्रुटि हुई। कृपया पुनः प्रयास करें।',
    clinicalBrief: 'क्लिनिकल इंटेक ब्रीफ',
    summary: 'सारांश',
    chiefComplaint: 'मुख्य शिकायत',
    riskFlags: 'जोखिम संकेत',
    vitalsToCheck: 'जांचने योग्य वाइटल्स',
    icd10: 'ICD-10 संकेत',
    medicationsNote: 'दवाओं पर नोट',
    suggestedFollowups: 'डॉक्टर के लिए सुझाव',
    markReviewed: 'समीक्षित चिह्नित करें',
    edit: 'संपादित करें',
    export_: 'निर्यात करें',
    loading: 'लोड हो रहा है...',
    readyForDoctor: 'डॉक्टर समीक्षा के लिए तैयार',
    whatIsYourName: 'आपका नाम क्या है?',
    patientDetails: 'रोगी विवरण',
    reviewConsent: 'समीक्षा और सहमति',
    fullName: 'पूरा नाम',
    dateOfBirth: 'जन्म तिथि',
    mobileNumber: 'मोबाइल नंबर',
    namePlaceholder: 'जैसे, प्रिया शर्मा',
    mobilePlaceholder: '+919876543210',
    consentText: 'मैं अपनी सहमति देता/देती हूं',
    consentDetail: 'मैं क्लिनिक विज़िट के दौरान पहचान उद्देश्यों के लिए अपने चेहरे के डेटा को कैप्चर और संग्रहीत करने का अधिकार देता/देती हूं।',
    registerPatient: 'पुष्टि करें और पंजीकृत करें',
    welcomeMessage: 'स्वागत है, {name}!',
    redirecting: 'रोगी सफलतापूर्वक पंजीकृत। इंटेक पर रीडायरेक्ट कर रहे हैं...',
    preparingIntake: 'एआई इंटेक वार्तालाप तैयार कर रहे हैं...',
    selectLanguage: 'भाषा चुनें',
    language: 'भाषा',
    nameRequired: 'रोगी का नाम आवश्यक है',
    nameTooShort: 'नाम कम से कम 2 अक्षर का होना चाहिए',
    dobRequired: 'जन्म तिथि आवश्यक है',
    ageInvalid: 'रोगी की आयु 0 से 120 वर्ष के बीच होनी चाहिए',
    mobileInvalid: 'एक वैध मोबाइल नंबर दर्ज करें (जैसे, +919876543210)',
    consentRequired: 'चेहरे का डेटा संग्रहीत करने के लिए रोगी की सहमति आवश्यक है',
    noFaceData: 'कोई चेहरा डेटा कैप्चर नहीं हुआ। कृपया पुनः प्रयास करें।',
    livenessRequired: 'जीवितता जांच पास नहीं हुई। कृपया पलक झपकाने की चुनौती पूरी करें।',
    registrationFailed: 'पंजीकरण विफल',
    cameraError: 'कैमरा एक्सेस विफल',
    cameraNotSupported: 'इस ब्राउज़र में कैमरा एक्सेस समर्थित नहीं है',
    identitySearchFailed: 'चेहरा पहचान विफल। कृपया पुनः प्रयास करें।',
    faceNotLoaded: 'चेहरा पहचान मॉडल अभी लोड नहीं हुआ। कृपया प्रतीक्षा करें।',
    aiThinking: 'एआई सोच रहा है...',
  },

  mr: {
    appName: 'आयुरटॉक केअर',
    brandTagline: 'एआय-चालित क्लिनिक इंटेक प्रणाली',
    intakeSession: 'इंटेक सत्र',
    unknownPatient: 'अज्ञात रुग्ण',
    dashboard: 'डॅशबोर्ड',
    back: 'मागे',
    cancel: 'रद्द करा',
    continue_: 'पुढे',
    confirm: 'पुष्टी करा',
    startCamera: 'कॅमेरा सुरू करा',
    stopCamera: 'कॅमेरा बंद करा',
    switchToRear: 'मागील कॅमेर्यावर स्विच करा',
    switchToFront: 'पुढील कॅमेर्यावर स्विच करा',
    detectingCameras: 'कॅमेरे शोधत आहे...',
    frontCamera: 'पुढील',
    rearCamera: 'मागील',
    camerasAvailable: '{count} कॅमेरा{plural} उपलब्ध',
    cameraNotStarted: 'कॅमेरा सुरू नाही',
    waitingForCamera: 'कॅमेर्याची प्रतीक्षा...',
    detecting: 'चेहरा शोधत आहे',
    positionFace: 'तुमचा चेहरा मध्यभागी ठेवा',
    confidencePercent: '{percent}% विश्वास',
    livenessCheck: 'जिवंतपणा तपासणी',
    blinksNeeded: 'कृपया नैसर्गिकरीत्या डोळे मिचकावा ({remaining} डोळे मिचकावणे आवश्यक)',
    blinkDetected: 'डोळे मिचकावले आढळले!',
    faceMatched: 'चेहरा जुळला — {percent}%',
    searchingIdentity: 'ओळख शोधत आहे...',
    patientIdentified: 'रुग्णाची ओळख पटली',
    newPatientRegistration: 'नवीन रुग्ण नोंदणी',
    noMatchFound: 'नवीन रुग्ण — नोंदणी आवश्यक',
    aiVoiceIntake: 'एआय व्हॉइस इंटेक',
    inConversation: 'संभाषणात',
    allInfoGathered: 'सर्व माहिती गोळा',
    thinking: 'विचार करत आहे',
    typeResponse: 'तुमचे उत्तर टाइप करा किंवा माइक टॅप करा...',
    listening: 'ऐकत आहे...',
    startIntake: 'एआय इंटेक सुरू करा',
    readyToBegin: 'इंटेक संभाषण सुरू करण्यासाठी तयार',
    intakeDesc: 'एआय सहाय्यक लक्षणे, कालावधी आणि वैद्यकीय इतिहासाबद्दल विचारेल',
    completeIntake: 'इंटेक पूर्ण करा आणि ब्रीफ तयार करा',
    generateBrief: 'ब्रीफ तयार करत आहे',
    intakeComplete: 'इंटेक पूर्ण',
    briefGenerated: 'क्लिनिकल ब्रीफ डॉक्टरसाठी तयार आहे.',
    conversationError: 'संभाषण त्रुटी',
    tryAgain: 'क्षमस्व, त्रुटी आली. कृपया पुन्हा प्रयत्न करा.',
    clinicalBrief: 'क्लिनिकल इंटेक ब्रीफ',
    summary: 'सारांश',
    chiefComplaint: 'मुख्य तक्रार',
    riskFlags: 'जोखीम निर्देशक',
    vitalsToCheck: 'तपासण्यासाठी व्हाइटल्स',
    icd10: 'ICD-10 संकेत',
    medicationsNote: 'औषधांवर टीप',
    suggestedFollowups: 'डॉक्टरांसाठी सूचना',
    markReviewed: 'पुनरावलोकन केले म्हणून चिन्हांकित करा',
    edit: 'संपादित करा',
    export_: 'निर्यात करा',
    loading: 'लोड करत आहे...',
    readyForDoctor: 'डॉक्टर पुनरावलोकनासाठी तयार',
    whatIsYourName: 'तुमचे नाव काय आहे?',
    patientDetails: 'रुग्ण तपशील',
    reviewConsent: 'पुनरावलोकन आणि संमती',
    fullName: 'पूर्ण नाव',
    dateOfBirth: 'जन्म तारीख',
    mobileNumber: 'मोबाइल नंबर',
    namePlaceholder: 'उदा., प्रिया शर्मा',
    mobilePlaceholder: '+919876543210',
    consentText: 'मी माझी संमती देतो/देते',
    consentDetail: 'मी क्लिनिक भेटीदरम्यान ओळख उद्देशांसाठी माझ्या चेहर्याचा डेटा कॅप्चर आणि संग्रहित करण्यास अधिकृत करतो/करते.',
    registerPatient: 'पुष्टी करा आणि नोंदणी करा',
    welcomeMessage: 'स्वागत आहे, {name}!',
    redirecting: 'रुग्ण यशस्वीरित्या नोंदणीकृत. इंटेककडे पुनर्निर्देशित करत आहे...',
    preparingIntake: 'एआय इंटेक संभाषण तयार करत आहे...',
    selectLanguage: 'भाषा निवडा',
    language: 'भाषा',
    nameRequired: 'रुग्णाचे नाव आवश्यक आहे',
    nameTooShort: 'नाव किमान 2 अक्षरे असणे आवश्यक आहे',
    dobRequired: 'जन्म तारीख आवश्यक आहे',
    ageInvalid: 'रुग्णाचे वय 0 ते 120 वर्षे दरम्यान असावे',
    mobileInvalid: 'वैध मोबाइल नंबर प्रविष्ट करा (उदा., +919876543210)',
    consentRequired: 'चेहर्याचा डेटा संग्रहित करण्यासाठी रुग्णाची संमती आवश्यक आहे',
    noFaceData: 'चेहर्याचा डेटा कॅप्चर झाला नाही. कृपया पुन्हा प्रयत्न करा.',
    livenessRequired: 'जिवंतपणा तपासणी उत्तीर्ण झाली नाही. कृपया डोळे मिचकावण्याचे आव्हान पूर्ण करा.',
    registrationFailed: 'नोंदणी अयशस्वी',
    cameraError: 'कॅमेरा प्रवेश अयशस्वी',
    cameraNotSupported: 'या ब्राउझरमध्ये कॅमेरा प्रवेश समर्थित नाही',
    identitySearchFailed: 'चेहरा ओळख अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
    faceNotLoaded: 'चेहरा शोध मॉडेल अद्याप लोड झाले नाही. कृपया प्रतीक्षा करा.',
    aiThinking: 'एआय विचार करत आहे...',
  },

  es: {
    appName: 'AyuTalk Care',
    brandTagline: 'Sistema de Admisión Clínica con IA',
    intakeSession: 'Sesión de Admisión',
    unknownPatient: 'Paciente Desconocido',
    dashboard: 'Panel',
    back: 'Atrás',
    cancel: 'Cancelar',
    continue_: 'Continuar',
    confirm: 'Confirmar',
    startCamera: 'Iniciar Cámara',
    stopCamera: 'Detener Cámara',
    switchToRear: 'Cambiar a cámara trasera',
    switchToFront: 'Cambiar a cámara frontal',
    detectingCameras: 'Detectando cámaras...',
    frontCamera: 'Frontal',
    rearCamera: 'Trasera',
    camerasAvailable: '{count} cámara{plural} disponible{plural}',
    cameraNotStarted: 'Cámara no iniciada',
    waitingForCamera: 'Esperando cámara...',
    detecting: 'Detectando rostro',
    positionFace: 'Coloque su rostro en el centro',
    confidencePercent: '{percent}% de confianza',
    livenessCheck: 'Verificación de vida',
    blinksNeeded: 'Parpadee naturalmente ({remaining} parpadeos necesarios)',
    blinkDetected: '¡Parpadeo detectado!',
    faceMatched: 'Rostro coincidente — {percent}%',
    searchingIdentity: 'Buscando identidad...',
    patientIdentified: 'Paciente Identificado',
    newPatientRegistration: 'Registro de Nuevo Paciente',
    noMatchFound: 'Nuevo paciente — registro requerido',
    aiVoiceIntake: 'Admisión por Voz con IA',
    inConversation: 'En conversación',
    allInfoGathered: 'Toda la información recopilada',
    thinking: 'Pensando',
    typeResponse: 'Escriba su respuesta o toque el micrófono...',
    listening: 'Escuchando...',
    startIntake: 'Iniciar Admisión con IA',
    readyToBegin: 'Listo para comenzar la conversación de admisión',
    intakeDesc: 'El asistente de IA preguntará sobre síntomas, duración e historial médico',
    completeIntake: 'Completar Admisión y Generar Informe',
    generateBrief: 'Generando Informe',
    intakeComplete: 'Admisión Completa',
    briefGenerated: 'El informe clínico está listo para el médico.',
    conversationError: 'Error de Conversación',
    tryAgain: 'Lo siento, ocurrió un error. Por favor, intente de nuevo.',
    clinicalBrief: 'Informe Clínico de Admisión',
    summary: 'Resumen',
    chiefComplaint: 'Queja Principal',
    riskFlags: 'Señales de Riesgo',
    vitalsToCheck: 'Signos Vitales a Revisar',
    icd10: 'Sugerencias ICD-10',
    medicationsNote: 'Nota de Medicamentos',
    suggestedFollowups: 'Sugerencias para el Médico',
    markReviewed: 'Marcar como Revisado',
    edit: 'Editar',
    export_: 'Exportar',
    loading: 'Cargando...',
    readyForDoctor: 'Listo para revisión del médico',
    whatIsYourName: '¿Cuál es su nombre?',
    patientDetails: 'Detalles del Paciente',
    reviewConsent: 'Revisar y Consentir',
    fullName: 'Nombre Completo',
    dateOfBirth: 'Fecha de Nacimiento',
    mobileNumber: 'Número Móvil',
    namePlaceholder: 'ej., Priya Sharma',
    mobilePlaceholder: '+919876543210',
    consentText: 'Doy mi consentimiento',
    consentDetail: 'Autorizo la captura y almacenamiento de mis datos faciales con fines de identificación durante las visitas clínicas.',
    registerPatient: 'Confirmar y Registrar',
    welcomeMessage: '¡Bienvenido/a, {name}!',
    redirecting: 'Paciente registrado exitosamente. Redirigiendo a la admisión...',
    preparingIntake: 'Preparando la conversación de admisión con IA...',
    selectLanguage: 'Seleccionar Idioma',
    language: 'Idioma',
    nameRequired: 'El nombre del paciente es obligatorio',
    nameTooShort: 'El nombre debe tener al menos 2 caracteres',
    dobRequired: 'La fecha de nacimiento es obligatoria',
    ageInvalid: 'La edad del paciente debe estar entre 0 y 120 años',
    mobileInvalid: 'Ingrese un número móvil válido (ej., +919876543210)',
    consentRequired: 'Se requiere el consentimiento del paciente para almacenar datos faciales',
    noFaceData: 'No se capturaron datos faciales. Por favor, intente de nuevo.',
    livenessRequired: 'Verificación de vida no superada. Complete el desafío de parpadeo.',
    registrationFailed: 'Registro fallido',
    cameraError: 'Error al acceder a la cámara',
    cameraNotSupported: 'El acceso a la cámara no es compatible con este navegador',
    identitySearchFailed: 'Identificación facial fallida. Por favor, intente de nuevo.',
    faceNotLoaded: 'El modelo de detección facial aún no se ha cargado. Por favor, espere.',
    aiThinking: 'La IA está pensando...',
  },
};

export function t(locale: SupportedLocale, key: keyof Translations, params?: Record<string, string | number>): string {
  let value = translations[locale][key] ?? translations.en[key] ?? `[${key}]`;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      value = value.replace(`{${k}}`, String(v));
    });
  }
  return value;
}

export function detectLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'en';
  const lang = navigator.language?.toLowerCase() ?? 'en';
  if (lang.startsWith('hi')) return 'hi';
  if (lang.startsWith('mr')) return 'mr';
  if (lang.startsWith('es')) return 'es';
  return 'en';
}
