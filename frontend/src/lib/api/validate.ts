import { NextResponse } from 'next/server';
import { z } from 'zod';

export type ValidationFailure = {
  success: false;
  response: NextResponse;
  error: string;
  fields: Record<string, string>;
  issues: z.ZodIssue[];
};

export type ValidationSuccess<T> = {
  success: true;
  data: T;
};

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

/**
 * Formate les erreurs Zod en réponse HTTP 400 standardisée KlickDrive
 */
export function formatValidationError(error: z.ZodError): NextResponse {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const fieldName = issue.path.join('.') || 'root';
    if (!fields[fieldName]) {
      fields[fieldName] = issue.message;
    }
  }

  const primaryMessage = error.issues[0]?.message ?? 'Données de formulaire invalides.';

  return NextResponse.json(
    {
      success: false,
      error: primaryMessage,
      fields,
      issues: error.issues,
    },
    { status: 400 }
  );
}

/**
 * Valide un objet JavaScript déjà extrait par rapport à un schéma Zod
 */
export function validateJson<T>(
  data: unknown,
  schema: z.ZodType<T>
): ValidationResult<T> {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const primaryMessage = parsed.error.issues[0]?.message ?? 'Données invalides.';
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const fieldName = issue.path.join('.') || 'root';
      if (!fields[fieldName]) {
        fields[fieldName] = issue.message;
      }
    }

    return {
      success: false,
      response: formatValidationError(parsed.error),
      error: primaryMessage,
      fields,
      issues: parsed.error.issues,
    };
  }

  return {
    success: true,
    data: parsed.data,
  };
}

/**
 * Valide le corps JSON d'une requête HTTP (Request ou NextRequest)
 */
export async function validateBody<T>(
  req: Request,
  schema: z.ZodType<T>,
  options: { honeypotField?: string } = { honeypotField: 'website' }
): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Format JSON invalide.',
        fields: { root: 'Corps de requête JSON attendu' },
        issues: [],
      },
      { status: 400 }
    );
    return {
      success: false,
      response,
      error: 'Format JSON invalide.',
      fields: { root: 'Corps de requête JSON attendu' },
      issues: [],
    };
  }

  if (typeof body !== 'object' || body === null) {
    const response = NextResponse.json(
      {
        success: false,
        error: 'Le corps de la requête doit être un objet JSON.',
        fields: { root: 'Objet JSON attendu' },
        issues: [],
      },
      { status: 400 }
    );
    return {
      success: false,
      response,
      error: 'Le corps de la requête doit être un objet JSON.',
      fields: { root: 'Objet JSON attendu' },
      issues: [],
    };
  }

  // Vérification champ piège anti-bot
  if (options.honeypotField && options.honeypotField in body) {
    const honeypotVal = (body as Record<string, unknown>)[options.honeypotField];
    if (typeof honeypotVal === 'string' && honeypotVal.trim().length > 0) {
      const response = NextResponse.json(
        {
          success: false,
          error: 'Requête refusée.',
          fields: {},
          issues: [],
        },
        { status: 400 }
      );
      return {
        success: false,
        response,
        error: 'Requête refusée.',
        fields: {},
        issues: [],
      };
    }
  }

  return validateJson(body, schema);
}

/**
 * Valide les paramètres d'URL (Query String / SearchParams)
 */
export function validateQuery<T>(
  searchParams: URLSearchParams | { [key: string]: string | string[] | undefined },
  schema: z.ZodType<T>
): ValidationResult<T> {
  let plainObject: Record<string, unknown>;

  if (searchParams instanceof URLSearchParams) {
    plainObject = {};
    for (const [key, value] of searchParams.entries()) {
      plainObject[key] = value;
    }
  } else {
    plainObject = { ...searchParams };
  }

  return validateJson(plainObject, schema);
}

