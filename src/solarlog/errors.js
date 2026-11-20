// -----------------------------------------------------------------------------
// Errors of the Solar-Log link, each with the message the user reads in the
// Configuration screen (connection status, "Test the connection").
// -----------------------------------------------------------------------------

export const ERROR_CODES = {
  NOT_CONFIGURED: 'not_configured',
  UNREACHABLE: 'unreachable',
  AUTH: 'auth',
  JSON_DISABLED: 'json_disabled',
  INVALID_DATA: 'invalid_data',
};

const MESSAGES = {
  [ERROR_CODES.NOT_CONFIGURED]: {
    en: 'Enter the address of your Solar-Log in the configuration.',
    fr: "Saisissez l'adresse de votre Solar-Log dans la configuration.",
    de: 'Gib die Adresse deines Solar-Log in der Konfiguration ein.',
    es: 'Introduzca la dirección de su Solar-Log en la configuración.',
  },
  [ERROR_CODES.UNREACHABLE]: {
    en: 'The Solar-Log does not answer: check its address and that it is on the same network.',
    fr: 'Le Solar-Log ne répond pas : vérifiez son adresse et qu’il est sur le même réseau.',
    de: 'Der Solar-Log antwortet nicht: Prüfe seine Adresse und ob er im selben Netzwerk ist.',
    es: 'El Solar-Log no responde: compruebe su dirección y que esté en la misma red.',
  },
  [ERROR_CODES.AUTH]: {
    en: 'The Solar-Log refused the password of the "user" access level.',
    fr: 'Le Solar-Log a refusé le mot de passe du niveau d’accès « utilisateur ».',
    de: 'Der Solar-Log hat das Passwort der Zugriffsebene „Benutzer“ abgelehnt.',
    es: 'El Solar-Log rechazó la contraseña del nivel de acceso «usuario».',
  },
  [ERROR_CODES.JSON_DISABLED]: {
    en: 'The open JSON interface is disabled: turn it on in the Solar-Log (Configuration > System > Access control).',
    fr: "L'interface JSON ouverte est désactivée : activez-la dans le Solar-Log (Configuration > Système > Contrôle d'accès).",
    de: 'Die offene JSON-Schnittstelle ist deaktiviert: Aktiviere sie im Solar-Log (Konfiguration > System > Zugangskontrolle).',
    es: 'La interfaz JSON abierta está desactivada: actívela en el Solar-Log (Configuración > Sistema > Control de acceso).',
  },
  [ERROR_CODES.INVALID_DATA]: {
    en: 'The Solar-Log sent unusable data (this happens right after it restarts).',
    fr: 'Le Solar-Log a envoyé des données inutilisables (cela arrive juste après son redémarrage).',
    de: 'Der Solar-Log hat unbrauchbare Daten gesendet (das passiert direkt nach einem Neustart).',
    es: 'El Solar-Log envió datos inutilizables (ocurre justo después de reiniciarse).',
  },
};

export class SolarLogError extends Error {
  /**
   * @param {string} code one of ERROR_CODES
   * @param {string} [detail] technical detail, for the logs only
   */
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'SolarLogError';
    this.code = code;
  }

  /** The multi-language message shown to the user. */
  get userMessage() {
    return MESSAGES[this.code] ?? MESSAGES[ERROR_CODES.UNREACHABLE];
  }
}

/** The user message of any error: a Solar-Log one, or "unreachable". */
export function userMessageOf(error) {
  return error instanceof SolarLogError ? error.userMessage : MESSAGES[ERROR_CODES.UNREACHABLE];
}
