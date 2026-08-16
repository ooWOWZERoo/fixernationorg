import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { NextPageWithLayout } from "@/types/next";

// ─── Types ────────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type AuthLevel = "public" | "admin" | "super_admin";

interface Param {
  name: string;
  type: string;
  required?: boolean;
  description: string;
}

interface EndpointDoc {
  id: string;
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  auth: AuthLevel;
  queryParams?: Param[];
  bodyParams?: Param[];
  response?: string;
  curl?: string;
  note?: string;
}

interface GroupDoc {
  id: string;
  label: string;
  description?: string;
  endpoints: EndpointDoc[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET:    "bg-emerald-100 text-emerald-800",
  POST:   "bg-blue-100 text-blue-800",
  PUT:    "bg-amber-100 text-amber-800",
  PATCH:  "bg-orange-100 text-orange-800",
  DELETE: "bg-red-100 text-red-700",
};

const AUTH_META: Record<AuthLevel, { label: string; color: string }> = {
  public:      { label: "Public",      color: "bg-green-100 text-green-800" },
  admin:       { label: "Admin",       color: "bg-sky-100 text-sky-800" },
  super_admin: { label: "Super Admin", color: "bg-violet-100 text-violet-800" },
};

const B = "https://fixernation.org";
const CK = "Cookie: __Secure-next-auth.session-token=<token>";

// ─── API Spec ─────────────────────────────────────────────────────────────────

const SPEC: GroupDoc[] = [
  {
    id: "overview",
    label: "Overview",
    description: `The Fixer Nation REST API follows standard HTTP conventions. Every request and response uses JSON unless stated otherwise. The base URL for all endpoints is ${B}. The API is designed primarily for browser-based admin use; external integrations authenticate via a NextAuth session cookie obtained by signing in.`,
    endpoints: [],
  },
  {
    id: "authentication",
    label: "Authentication",
    description: `Session-based auth via NextAuth.js. After signing in, the browser session token is stored in a cookie and included automatically. For programmatic access, perform a sign-in request, capture the session cookie, and pass it with each subsequent request. Over HTTPS the cookie is named __Secure-next-auth.session-token. Over HTTP (dev only) it is next-auth.session-token.`,
    endpoints: [
      {
        id: "auth-register",
        method: "POST",
        path: "/api/auth/register",
        summary: "Create a new user account",
        auth: "public",
        bodyParams: [
          { name: "email", type: "string", required: true, description: "Email address for the account" },
          { name: "password", type: "string", required: true, description: "Password (min 8 characters)" },
          { name: "name", type: "string", description: "Display name" },
        ],
        response: `{"message":"Verification email sent. Please check your inbox."}`,
        curl: `curl -X POST ${B}/api/auth/register \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jane@example.com","password":"secret123","name":"Jane"}'`,
      },
      {
        id: "auth-forgot",
        method: "POST",
        path: "/api/auth/forgot-password",
        summary: "Request a password reset link",
        auth: "public",
        bodyParams: [
          { name: "email", type: "string", required: true, description: "Registered email address" },
        ],
        response: `{"message":"If that email is registered, a reset link is on its way."}`,
        curl: `curl -X POST ${B}/api/auth/forgot-password \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jane@example.com"}'`,
      },
    ],
  },

  // ── Contacts ────────────────────────────────────────────────────────────────
  {
    id: "contacts",
    label: "Contacts",
    description: "Contacts are the core CRM entity. A contact can exist independently of a user account, enabling you to manage newsletter subscribers, imported lists, and event attendees who have never signed up to the platform.",
    endpoints: [
      {
        id: "contacts-list",
        method: "GET",
        path: "/api/admin/contacts",
        summary: "List contacts",
        auth: "admin",
        queryParams: [
          { name: "q", type: "string", description: "Full-text search across email, name, phone, company" },
          { name: "tag", type: "string", description: "Filter by tag value" },
          { name: "attribution", type: "string", description: "Filter by attribution source: ORGANIC, REFERRAL, IMPORT, MANUAL, INVITE, SUBSCRIBE_FORM, CAMPAIGN" },
          { name: "topic", type: "string", description: "Filter by newsletter topic slug" },
          { name: "list", type: "string", description: "Filter by contact list ID" },
          { name: "page", type: "number", description: "Page number (default 1)" },
          { name: "limit", type: "number", description: "Results per page (default 50, max 200)" },
        ],
        response: `{
  "contacts": [
    {
      "id": "clx1abc...",
      "email": "jane@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "phone": null,
      "company": null,
      "source": "import",
      "createdAt": "2026-08-15T12:00:00.000Z",
      "userId": null,
      "attribution": { "source": "IMPORT" },
      "tags": [{"tag": "newsletter"}, {"tag": "vip"}]
    }
  ],
  "total": 1,
  "page": 1,
  "pages": 1
}`,
        curl: `curl "${B}/api/admin/contacts?q=jane&tag=newsletter" \\
  -H "${CK}"`,
      },
      {
        id: "contacts-create",
        method: "POST",
        path: "/api/admin/contacts",
        summary: "Create a contact",
        auth: "admin",
        bodyParams: [
          { name: "email", type: "string", required: true, description: "Contact email address" },
          { name: "firstName", type: "string", description: "First name" },
          { name: "lastName", type: "string", description: "Last name" },
          { name: "phone", type: "string", description: "Phone number" },
          { name: "company", type: "string", description: "Company or organization" },
          { name: "source", type: "string", description: "Contact origin (admin, import, form, etc.)" },
          { name: "tags", type: "string[]", description: "Tags to apply on creation" },
        ],
        response: `{
  "id": "clx1abc...",
  "email": "jane@example.com",
  "firstName": "Jane",
  "createdAt": "2026-08-16T09:00:00.000Z"
}`,
        curl: `curl -X POST ${B}/api/admin/contacts \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jane@example.com","firstName":"Jane","tags":["newsletter"]}'`,
      },
      {
        id: "contacts-get",
        method: "GET",
        path: "/api/admin/contacts/:id",
        summary: "Get a contact",
        auth: "admin",
        response: `{
  "id": "clx1abc...",
  "email": "jane@example.com",
  "firstName": "Jane",
  "lastName": "Smith",
  "attribution": {
    "source": "ORGANIC",
    "attributedAt": "2026-08-15T12:00:00.000Z",
    "campaignId": null
  },
  "tags": [{"id":"t1","tag":"newsletter"}],
  "notes": [],
  "addresses": [],
  "identities": [],
  "subscriptions": [],
  "customFields": []
}`,
        curl: `curl ${B}/api/admin/contacts/clx1abc \\
  -H "${CK}"`,
      },
      {
        id: "contacts-update",
        method: "PUT",
        path: "/api/admin/contacts/:id",
        summary: "Update contact fields",
        auth: "admin",
        bodyParams: [
          { name: "firstName", type: "string", description: "Updated first name" },
          { name: "lastName", type: "string", description: "Updated last name" },
          { name: "phone", type: "string", description: "Updated phone" },
          { name: "company", type: "string", description: "Updated company" },
          { name: "email", type: "string", description: "Updated email (must be unique)" },
        ],
        curl: `curl -X PUT ${B}/api/admin/contacts/clx1abc \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"firstName":"Jane","company":"Acme Corp"}'`,
      },
      {
        id: "contacts-delete",
        method: "DELETE",
        path: "/api/admin/contacts/:id",
        summary: "Delete a contact",
        auth: "admin",
        note: "Permanently deletes the contact and all associated records (tags, notes, subscriptions, attribution). Cannot be undone.",
        curl: `curl -X DELETE ${B}/api/admin/contacts/clx1abc \\
  -H "${CK}"`,
      },
      {
        id: "contacts-patch",
        method: "PATCH",
        path: "/api/admin/contacts/:id",
        summary: "Sub-actions: add/remove tags, notes, attribution, consent",
        auth: "admin",
        description: "A single PATCH endpoint that dispatches different actions based on the action field in the request body.",
        bodyParams: [
          { name: "action", type: "string", required: true, description: "add-note | add-tag | remove-tag | set-attribution | set-consent" },
          { name: "note", type: "string", description: "Note body (add-note)" },
          { name: "tag", type: "string", description: "Tag string (add-tag, remove-tag)" },
          { name: "source", type: "string", description: "Attribution source enum (set-attribution)" },
          { name: "campaignId", type: "string", description: "Campaign ID for CAMPAIGN attribution" },
          { name: "topic", type: "string", description: "Newsletter topic slug (set-consent)" },
          { name: "optedIn", type: "boolean", description: "Consent value (set-consent)" },
        ],
        curl: `# Add a tag
curl -X PATCH ${B}/api/admin/contacts/clx1abc \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"add-tag","tag":"vip"}'

# Set attribution
curl -X PATCH ${B}/api/admin/contacts/clx1abc \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"set-attribution","source":"REFERRAL"}'`,
      },
      {
        id: "contacts-activity",
        method: "GET",
        path: "/api/admin/contacts/:id/activity",
        summary: "Get the contact activity timeline",
        auth: "admin",
        response: `{
  "events": [
    {
      "id": "ev1",
      "type": "SUBSCRIPTION_UPDATED",
      "description": "Subscribed to Morning Boost",
      "occurredAt": "2026-08-15T12:05:00.000Z"
    }
  ]
}`,
        curl: `curl ${B}/api/admin/contacts/clx1abc/activity \\
  -H "${CK}"`,
      },
      {
        id: "contacts-merge",
        method: "POST",
        path: "/api/admin/contacts/:id/merge",
        summary: "Merge a duplicate into this contact",
        auth: "admin",
        description: "Merges the source contact (sourceId) into this one (URL :id). Tags, notes, and subscriptions are transferred. The source contact is deleted.",
        bodyParams: [
          { name: "sourceId", type: "string", required: true, description: "ID of the duplicate contact to merge from and delete" },
        ],
        curl: `curl -X POST ${B}/api/admin/contacts/clx1abc/merge \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"sourceId":"clxDUPLICATE"}'`,
      },
      {
        id: "contacts-export",
        method: "GET",
        path: "/api/admin/contacts/export",
        summary: "Export contacts as CSV",
        auth: "admin",
        description: "Returns a CSV file download. Accepts the same filters as the list endpoint.",
        queryParams: [
          { name: "q", type: "string", description: "Search query" },
          { name: "tag", type: "string", description: "Filter by tag" },
          { name: "list", type: "string", description: "Filter by list ID" },
        ],
        curl: `curl "${B}/api/admin/contacts/export?tag=newsletter" \\
  -H "${CK}" -o contacts.csv`,
      },
      {
        id: "contacts-import",
        method: "POST",
        path: "/api/admin/contacts/import",
        summary: "Import contacts from CSV",
        auth: "admin",
        description: "Accepts a multipart/form-data upload. CSV must have at minimum an email column.",
        bodyParams: [
          { name: "file", type: "File", required: true, description: "CSV file (multipart/form-data)" },
          { name: "listId", type: "string", description: "Add all imported contacts to this list" },
          { name: "tag", type: "string", description: "Tag to apply to all imported contacts" },
        ],
        response: `{"created": 148, "skipped": 3, "errors": []}`,
        curl: `curl -X POST ${B}/api/admin/contacts/import \\
  -H "${CK}" \\
  -F "file=@contacts.csv" \\
  -F "tag=import-aug-2026"`,
      },
    ],
  },

  // ── Contact Addresses ────────────────────────────────────────────────────────
  {
    id: "contact-addresses",
    label: "Contact Addresses",
    endpoints: [
      {
        id: "addr-list",
        method: "GET",
        path: "/api/admin/contacts/:id/addresses",
        summary: "List addresses for a contact",
        auth: "admin",
        curl: `curl ${B}/api/admin/contacts/clx1abc/addresses \\
  -H "${CK}"`,
      },
      {
        id: "addr-create",
        method: "POST",
        path: "/api/admin/contacts/:id/addresses",
        summary: "Add an address",
        auth: "admin",
        bodyParams: [
          { name: "street", type: "string", description: "Street line 1" },
          { name: "street2", type: "string", description: "Unit, suite, etc." },
          { name: "city", type: "string", description: "City" },
          { name: "state", type: "string", description: "State abbreviation" },
          { name: "zip", type: "string", description: "ZIP or postal code" },
          { name: "country", type: "string", description: "Country code (default US)" },
          { name: "label", type: "string", description: "home, work, billing, etc." },
        ],
        curl: `curl -X POST ${B}/api/admin/contacts/clx1abc/addresses \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"street":"123 Main St","city":"Austin","state":"TX","zip":"78701"}'`,
      },
      {
        id: "addr-update",
        method: "PUT",
        path: "/api/admin/contacts/:id/addresses/:addrId",
        summary: "Update or delete an address",
        auth: "admin",
        note: "Send DELETE to remove the address.",
        curl: `curl -X PUT ${B}/api/admin/contacts/clx1abc/addresses/addr1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"city":"Houston","zip":"77001"}'`,
      },
    ],
  },

  // ── Contact Identities ───────────────────────────────────────────────────────
  {
    id: "contact-identities",
    label: "Contact Identities",
    description: "A contact can have multiple email addresses, phone numbers, or external IDs. The primary email is on the Contact record; identities store additional linked identifiers.",
    endpoints: [
      {
        id: "identities-list",
        method: "GET",
        path: "/api/admin/contacts/:id/identities",
        summary: "List identities",
        auth: "admin",
        curl: `curl ${B}/api/admin/contacts/clx1abc/identities \\
  -H "${CK}"`,
      },
      {
        id: "identities-create",
        method: "POST",
        path: "/api/admin/contacts/:id/identities",
        summary: "Add an identity",
        auth: "admin",
        bodyParams: [
          { name: "type", type: "string", required: true, description: "email, phone, or external" },
          { name: "value", type: "string", required: true, description: "The identity value" },
          { name: "label", type: "string", description: "work, personal, etc." },
        ],
        curl: `curl -X POST ${B}/api/admin/contacts/clx1abc/identities \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"type":"email","value":"jane.work@acme.com","label":"work"}'`,
      },
      {
        id: "identities-delete",
        method: "DELETE",
        path: "/api/admin/contacts/:id/identities/:identityId",
        summary: "Remove an identity",
        auth: "admin",
        curl: `curl -X DELETE ${B}/api/admin/contacts/clx1abc/identities/ident1 \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Custom Field Values ──────────────────────────────────────────────────────
  {
    id: "contact-custom-fields",
    label: "Custom Field Values",
    description: "Set values for admin-defined custom fields on a contact. Field definitions are managed via /api/admin/custom-fields.",
    endpoints: [
      {
        id: "cfv-set",
        method: "PUT",
        path: "/api/admin/contacts/:id/custom-fields",
        summary: "Set custom field values for a contact",
        auth: "admin",
        bodyParams: [
          { name: "fields", type: "object[]", required: true, description: "Array of {definitionId, value} pairs" },
        ],
        curl: `curl -X PUT ${B}/api/admin/contacts/clx1abc/custom-fields \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"fields":[{"definitionId":"def1","value":"Gold"}]}'`,
      },
    ],
  },

  // ── Lists ────────────────────────────────────────────────────────────────────
  {
    id: "lists",
    label: "Contact Lists",
    description: "Named collections of contacts used as campaign audiences. Contacts can appear on multiple lists.",
    endpoints: [
      {
        id: "lists-list",
        method: "GET",
        path: "/api/admin/lists",
        summary: "List all contact lists",
        auth: "admin",
        response: `{
  "lists": [
    {
      "id": "lst1",
      "name": "Newsletter Subscribers",
      "description": null,
      "createdAt": "2026-08-01T00:00:00.000Z",
      "_count": { "members": 482 }
    }
  ]
}`,
        curl: `curl ${B}/api/admin/lists \\
  -H "${CK}"`,
      },
      {
        id: "lists-create",
        method: "POST",
        path: "/api/admin/lists",
        summary: "Create a list",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "List name (must be unique)" },
          { name: "description", type: "string", description: "Optional description" },
        ],
        curl: `curl -X POST ${B}/api/admin/lists \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Newsletter Subscribers"}'`,
      },
      {
        id: "lists-get",
        method: "GET",
        path: "/api/admin/lists/:id",
        summary: "Get a list with member count",
        auth: "admin",
        curl: `curl ${B}/api/admin/lists/lst1 \\
  -H "${CK}"`,
      },
      {
        id: "lists-update",
        method: "PUT",
        path: "/api/admin/lists/:id",
        summary: "Update list name or description",
        auth: "admin",
        curl: `curl -X PUT ${B}/api/admin/lists/lst1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Monthly Newsletter"}'`,
      },
      {
        id: "lists-patch",
        method: "PATCH",
        path: "/api/admin/lists/:id",
        summary: "Add or remove contacts from a list",
        auth: "admin",
        bodyParams: [
          { name: "action", type: "string", required: true, description: "add-contacts or remove-contacts" },
          { name: "contactIds", type: "string[]", required: true, description: "Array of contact IDs" },
        ],
        curl: `curl -X PATCH ${B}/api/admin/lists/lst1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"add-contacts","contactIds":["clx1abc","clx2def"]}'`,
      },
      {
        id: "lists-delete",
        method: "DELETE",
        path: "/api/admin/lists/:id",
        summary: "Delete a list",
        auth: "admin",
        note: "Deleting a list does not delete the contacts on it.",
        curl: `curl -X DELETE ${B}/api/admin/lists/lst1 \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Campaigns ────────────────────────────────────────────────────────────────
  {
    id: "campaigns",
    label: "Campaigns",
    description: "Email campaigns targeting a contact list. Support A/B variants, scheduled sends, and detailed delivery analytics.",
    endpoints: [
      {
        id: "campaigns-list",
        method: "GET",
        path: "/api/admin/campaigns",
        summary: "List campaigns",
        auth: "admin",
        queryParams: [
          { name: "status", type: "string", description: "DRAFT | SCHEDULED | SENDING | SENT | PAUSED | CANCELLED" },
          { name: "q", type: "string", description: "Search by name" },
        ],
        response: `{
  "campaigns": [
    {
      "id": "cmp1",
      "name": "August Newsletter",
      "status": "DRAFT",
      "subject": "Welcome to August",
      "listId": "lst1",
      "scheduledAt": null,
      "sentAt": null,
      "createdAt": "2026-08-15T12:00:00.000Z",
      "_count": { "sends": 0 }
    }
  ]
}`,
        curl: `curl "${B}/api/admin/campaigns?status=DRAFT" \\
  -H "${CK}"`,
      },
      {
        id: "campaigns-create",
        method: "POST",
        path: "/api/admin/campaigns",
        summary: "Create a campaign",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Internal campaign name" },
          { name: "subject", type: "string", required: true, description: "Email subject line" },
          { name: "fromName", type: "string", required: true, description: "Sender display name" },
          { name: "fromEmail", type: "string", required: true, description: "Sender email address" },
          { name: "htmlBody", type: "string", description: "Email HTML content (or use templateId)" },
          { name: "textBody", type: "string", description: "Plain-text fallback" },
          { name: "templateId", type: "string", description: "Base it on an email template" },
          { name: "listId", type: "string", description: "Target contact list ID" },
          { name: "scheduledAt", type: "string", description: "ISO 8601 date — schedule for future delivery" },
        ],
        curl: `curl -X POST ${B}/api/admin/campaigns \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"August Newsletter","subject":"Welcome to August","fromName":"Fixer Nation","fromEmail":"campaigns@fixernation.org","listId":"lst1","htmlBody":"<h1>Hello!</h1>"}'`,
      },
      {
        id: "campaigns-get",
        method: "GET",
        path: "/api/admin/campaigns/:id",
        summary: "Get a campaign with variants and metrics",
        auth: "admin",
        curl: `curl ${B}/api/admin/campaigns/cmp1 \\
  -H "${CK}"`,
      },
      {
        id: "campaigns-update",
        method: "PUT",
        path: "/api/admin/campaigns/:id",
        summary: "Update a DRAFT campaign",
        auth: "admin",
        note: "Only DRAFT campaigns can be modified. Sent campaigns are read-only.",
        curl: `curl -X PUT ${B}/api/admin/campaigns/cmp1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"Updated Subject Line"}'`,
      },
      {
        id: "campaigns-action",
        method: "POST",
        path: "/api/admin/campaigns/:id",
        summary: "Trigger send or recompute delivery metrics",
        auth: "admin",
        bodyParams: [
          { name: "action", type: "string", required: true, description: "send or compute_metrics" },
        ],
        note: "The send action transitions the campaign from DRAFT to SENDING and begins delivery. Scheduled campaigns queue for the scheduledAt time.",
        curl: `# Send immediately
curl -X POST ${B}/api/admin/campaigns/cmp1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"send"}'

# Refresh delivery stats
curl -X POST ${B}/api/admin/campaigns/cmp1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"compute_metrics"}'`,
      },
      {
        id: "campaigns-delete",
        method: "DELETE",
        path: "/api/admin/campaigns/:id",
        summary: "Delete a campaign",
        auth: "admin",
        note: "Only DRAFT and CANCELLED campaigns can be deleted.",
        curl: `curl -X DELETE ${B}/api/admin/campaigns/cmp1 \\
  -H "${CK}"`,
      },
      {
        id: "campaigns-variants",
        method: "POST",
        path: "/api/admin/campaigns/:id/variants",
        summary: "Add an A/B variant to a campaign",
        auth: "admin",
        bodyParams: [
          { name: "label", type: "string", required: true, description: "Variant label (A, B, etc.)" },
          { name: "subject", type: "string", required: true, description: "Variant subject line" },
          { name: "htmlBody", type: "string", description: "Variant HTML content" },
          { name: "splitPercent", type: "number", description: "Audience percentage for this variant (0–100)" },
        ],
        curl: `curl -X POST ${B}/api/admin/campaigns/cmp1/variants \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"label":"B","subject":"Try This Subject","splitPercent":50}'`,
      },
      {
        id: "campaigns-preview",
        method: "POST",
        path: "/api/admin/campaigns/preview-audience",
        summary: "Preview estimated audience size",
        auth: "admin",
        bodyParams: [
          { name: "listId", type: "string", description: "Target list ID" },
          { name: "excludeUnsubscribed", type: "boolean", description: "Exclude suppressed contacts (default true)" },
        ],
        response: `{"count": 847, "suppressed": 12, "deliverable": 835}`,
        curl: `curl -X POST ${B}/api/admin/campaigns/preview-audience \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"listId":"lst1","excludeUnsubscribed":true}'`,
      },
      {
        id: "campaigns-test-send",
        method: "POST",
        path: "/api/admin/campaigns/test-send",
        summary: "Send a test email to a specific address",
        auth: "admin",
        bodyParams: [
          { name: "campaignId", type: "string", required: true, description: "Campaign to preview" },
          { name: "to", type: "string", required: true, description: "Recipient email address" },
        ],
        curl: `curl -X POST ${B}/api/admin/campaigns/test-send \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"campaignId":"cmp1","to":"admin@fixernation.org"}'`,
      },
    ],
  },

  // ── Email Templates ──────────────────────────────────────────────────────────
  {
    id: "email-templates",
    label: "Email Templates",
    description: "Reusable email templates with {{variable}} substitution. Use as a starting point when creating campaigns.",
    endpoints: [
      {
        id: "tmpl-list",
        method: "GET",
        path: "/api/admin/email-templates",
        summary: "List email templates",
        auth: "admin",
        curl: `curl ${B}/api/admin/email-templates \\
  -H "${CK}"`,
      },
      {
        id: "tmpl-create",
        method: "POST",
        path: "/api/admin/email-templates",
        summary: "Create a template",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Template name" },
          { name: "subject", type: "string", required: true, description: "Default subject (may contain {{variables}})" },
          { name: "htmlBody", type: "string", required: true, description: "HTML template body" },
          { name: "textBody", type: "string", description: "Plain-text fallback" },
          { name: "category", type: "string", description: "Organizational category" },
        ],
        curl: `curl -X POST ${B}/api/admin/email-templates \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Welcome","subject":"Welcome, {{first_name}}!","htmlBody":"<h1>Hi {{first_name}}</h1>"}'`,
      },
      {
        id: "tmpl-update",
        method: "PUT",
        path: "/api/admin/email-templates/:id",
        summary: "Update a template",
        auth: "admin",
        curl: `curl -X PUT ${B}/api/admin/email-templates/tpl1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"subject":"Updated Subject"}'`,
      },
      {
        id: "tmpl-delete",
        method: "DELETE",
        path: "/api/admin/email-templates/:id",
        summary: "Delete a template",
        auth: "admin",
        curl: `curl -X DELETE ${B}/api/admin/email-templates/tpl1 \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Automations ──────────────────────────────────────────────────────────────
  {
    id: "automations",
    label: "Automations",
    description: "Multi-step journey automations triggered by platform events (signup, role change, tag added, event RSVP). Steps can send emails, wait, add/remove tags, or evaluate conditions.",
    endpoints: [
      {
        id: "auto-list",
        method: "GET",
        path: "/api/admin/automations",
        summary: "List automation journeys",
        auth: "admin",
        curl: `curl ${B}/api/admin/automations \\
  -H "${CK}"`,
      },
      {
        id: "auto-create",
        method: "POST",
        path: "/api/admin/automations",
        summary: "Create a journey",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Journey name" },
          { name: "trigger", type: "string", required: true, description: "SIGNUP | ROLE_CHANGE | TAG_ADDED | EVENT_RSVP | MANUAL" },
          { name: "triggerConfig", type: "object", description: "Trigger-specific config (e.g. {tag:'vip'} for TAG_ADDED)" },
          { name: "active", type: "boolean", description: "Whether the journey is active (default false)" },
        ],
        curl: `curl -X POST ${B}/api/admin/automations \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Welcome Series","trigger":"SIGNUP","active":true}'`,
      },
      {
        id: "auto-get",
        method: "GET",
        path: "/api/admin/automations/:id",
        summary: "Get a journey with all steps",
        auth: "admin",
        curl: `curl ${B}/api/admin/automations/jrn1 \\
  -H "${CK}"`,
      },
      {
        id: "auto-update",
        method: "PUT",
        path: "/api/admin/automations/:id",
        summary: "Update journey settings",
        auth: "admin",
        curl: `curl -X PUT ${B}/api/admin/automations/jrn1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"active":false}'`,
      },
      {
        id: "auto-step",
        method: "PATCH",
        path: "/api/admin/automations/step",
        summary: "Update a step's config or canvas position",
        auth: "admin",
        bodyParams: [
          { name: "stepId", type: "string", required: true, description: "Step ID to update" },
          { name: "config", type: "object", description: "Step config (templateId, waitDuration, tag, etc.)" },
          { name: "posX", type: "number", description: "Canvas X position" },
          { name: "posY", type: "number", description: "Canvas Y position" },
        ],
        curl: `curl -X PATCH ${B}/api/admin/automations/step \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"stepId":"step1","config":{"templateId":"tpl1","waitDuration":86400}}'`,
      },
      {
        id: "auto-reorder",
        method: "PUT",
        path: "/api/admin/automations/reorder-steps",
        summary: "Reorder steps in a journey",
        auth: "admin",
        bodyParams: [
          { name: "journeyId", type: "string", required: true, description: "Journey ID" },
          { name: "stepIds", type: "string[]", required: true, description: "Ordered step IDs" },
        ],
        curl: `curl -X PUT ${B}/api/admin/automations/reorder-steps \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"journeyId":"jrn1","stepIds":["step2","step1","step3"]}'`,
      },
      {
        id: "auto-enroll",
        method: "POST",
        path: "/api/admin/automations/enroll",
        summary: "Manually enroll a contact in a journey",
        auth: "admin",
        bodyParams: [
          { name: "journeyId", type: "string", required: true, description: "Journey to enroll in" },
          { name: "contactId", type: "string", required: true, description: "Contact to enroll" },
        ],
        curl: `curl -X POST ${B}/api/admin/automations/enroll \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"journeyId":"jrn1","contactId":"clx1abc"}'`,
      },
      {
        id: "auto-enrollments",
        method: "GET",
        path: "/api/admin/automations/enrollments",
        summary: "List journey enrollments",
        auth: "admin",
        queryParams: [
          { name: "journeyId", type: "string", description: "Filter by journey" },
          { name: "contactId", type: "string", description: "Filter by contact" },
          { name: "status", type: "string", description: "ACTIVE | COMPLETED | PAUSED | CANCELLED" },
        ],
        curl: `curl "${B}/api/admin/automations/enrollments?status=ACTIVE" \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Newsletter Topics ────────────────────────────────────────────────────────
  {
    id: "newsletter-topics",
    label: "Newsletter Topics",
    description: "Named subscription topics that contacts can opt in or out of (Morning Boost, Campaigns, Product Updates, etc.).",
    endpoints: [
      {
        id: "topics-list",
        method: "GET",
        path: "/api/admin/newsletter-topics",
        summary: "List topics",
        auth: "admin",
        curl: `curl ${B}/api/admin/newsletter-topics \\
  -H "${CK}"`,
      },
      {
        id: "topics-create",
        method: "POST",
        path: "/api/admin/newsletter-topics",
        summary: "Create a topic",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Display name" },
          { name: "slug", type: "string", required: true, description: "URL-safe slug used in subscribe/unsubscribe links" },
          { name: "description", type: "string", description: "Subscriber-facing description" },
          { name: "defaultOptIn", type: "boolean", description: "Whether new contacts are opted in by default (default false)" },
        ],
        curl: `curl -X POST ${B}/api/admin/newsletter-topics \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Monthly Newsletter","slug":"monthly-newsletter","defaultOptIn":false}'`,
      },
      {
        id: "topics-update",
        method: "PUT",
        path: "/api/admin/newsletter-topics/:id",
        summary: "Update a topic",
        auth: "admin",
        curl: `curl -X PUT ${B}/api/admin/newsletter-topics/topic1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"defaultOptIn":true}'`,
      },
      {
        id: "topics-delete",
        method: "DELETE",
        path: "/api/admin/newsletter-topics/:id",
        summary: "Delete a topic",
        auth: "admin",
        curl: `curl -X DELETE ${B}/api/admin/newsletter-topics/topic1 \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Custom Fields ────────────────────────────────────────────────────────────
  {
    id: "custom-fields",
    label: "Custom Fields",
    description: "Admin-defined contact fields beyond the built-in properties. Support text, number, date, boolean, and dropdown types.",
    endpoints: [
      {
        id: "cf-list",
        method: "GET",
        path: "/api/admin/custom-fields",
        summary: "List custom field definitions",
        auth: "admin",
        curl: `curl ${B}/api/admin/custom-fields \\
  -H "${CK}"`,
      },
      {
        id: "cf-create",
        method: "POST",
        path: "/api/admin/custom-fields",
        summary: "Create a custom field",
        auth: "admin",
        bodyParams: [
          { name: "label", type: "string", required: true, description: "Field display name" },
          { name: "key", type: "string", required: true, description: "Internal snake_case key (also used as {{variable}} in templates)" },
          { name: "type", type: "string", required: true, description: "text | number | date | boolean | dropdown" },
          { name: "options", type: "string[]", description: "Allowed values (dropdown type only)" },
          { name: "required", type: "boolean", description: "Whether required on contact creation" },
        ],
        curl: `curl -X POST ${B}/api/admin/custom-fields \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"label":"Membership Tier","key":"membership_tier","type":"dropdown","options":["Bronze","Silver","Gold"]}'`,
      },
      {
        id: "cf-update",
        method: "PUT",
        path: "/api/admin/custom-fields/:id",
        summary: "Update a field definition",
        auth: "admin",
        note: "The field type cannot be changed after creation. Only label, options, and required can be updated.",
        curl: `curl -X PUT ${B}/api/admin/custom-fields/def1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"options":["Bronze","Silver","Gold","Platinum"]}'`,
      },
      {
        id: "cf-delete",
        method: "DELETE",
        path: "/api/admin/custom-fields/:id",
        summary: "Deactivate a custom field",
        auth: "admin",
        note: "Fields are soft-deleted so historical values are preserved.",
        curl: `curl -X DELETE ${B}/api/admin/custom-fields/def1 \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Suppression ──────────────────────────────────────────────────────────────
  {
    id: "suppression",
    label: "Suppression",
    description: "The suppression list tracks addresses that should never receive emails: hard bounces, spam complaints, one-click unsubscribes, and manual admin blocks.",
    endpoints: [
      {
        id: "sup-list",
        method: "GET",
        path: "/api/admin/suppression",
        summary: "List suppression records",
        auth: "admin",
        queryParams: [
          { name: "q", type: "string", description: "Search by email" },
          { name: "reason", type: "string", description: "BOUNCE | COMPLAINT | UNSUBSCRIBE | ADMIN" },
          { name: "page", type: "number", description: "Page number" },
        ],
        curl: `curl "${B}/api/admin/suppression?reason=BOUNCE" \\
  -H "${CK}"`,
      },
      {
        id: "sup-add",
        method: "POST",
        path: "/api/admin/suppression",
        summary: "Add a suppression",
        auth: "admin",
        bodyParams: [
          { name: "email", type: "string", required: true, description: "Email to suppress" },
          { name: "reason", type: "string", required: true, description: "ADMIN for manual adds; others are set automatically" },
          { name: "note", type: "string", description: "Internal note" },
        ],
        curl: `curl -X POST ${B}/api/admin/suppression \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jane@example.com","reason":"ADMIN","note":"Customer requested"}'`,
      },
      {
        id: "sup-delete",
        method: "DELETE",
        path: "/api/admin/suppression/:id",
        summary: "Lift a suppression",
        auth: "admin",
        note: "Re-enables email delivery to that address. Use with care.",
        curl: `curl -X DELETE ${B}/api/admin/suppression/sup1 \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Users ────────────────────────────────────────────────────────────────────
  {
    id: "users",
    label: "Users",
    description: "Platform user management. Role promotion requires SUPER_ADMIN privileges.",
    endpoints: [
      {
        id: "users-update",
        method: "PATCH",
        path: "/api/admin/users/:id",
        summary: "Update a user's role",
        auth: "super_admin",
        description: "Only SUPER_ADMINs can assign or remove ADMIN and SUPER_ADMIN roles. A SUPER_ADMIN cannot change their own role.",
        bodyParams: [
          { name: "role", type: "string", required: true, description: "CONSUMER | MEMBER | PROVIDER | AMBASSADOR | ADMIN | SUPER_ADMIN" },
        ],
        note: "Attempting to assign ADMIN or SUPER_ADMIN as a plain ADMIN returns 403.",
        curl: `curl -X PATCH ${B}/api/admin/users/usr1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"role":"ADMIN"}'`,
      },
    ],
  },

  // ── Applications ────────────────────────────────────────────────────────────
  {
    id: "applications",
    label: "Applications",
    description: "Service provider and brand ambassador applications submitted through the public onboarding forms.",
    endpoints: [
      {
        id: "apps-list",
        method: "GET",
        path: "/api/admin/applications",
        summary: "List applications",
        auth: "admin",
        queryParams: [
          { name: "type", type: "string", description: "PROVIDER or AMBASSADOR" },
          { name: "status", type: "string", description: "PENDING | UNDER_REVIEW | APPROVED | REJECTED | INVITED | ONBOARDED | SPAM" },
          { name: "q", type: "string", description: "Search by name or email" },
          { name: "page", type: "number", description: "Page number" },
        ],
        curl: `curl "${B}/api/admin/applications?status=PENDING&type=PROVIDER" \\
  -H "${CK}"`,
      },
      {
        id: "apps-get",
        method: "GET",
        path: "/api/admin/applications/:id",
        summary: "Get an application with all fields",
        auth: "admin",
        curl: `curl ${B}/api/admin/applications/app1 \\
  -H "${CK}"`,
      },
      {
        id: "apps-update",
        method: "PUT",
        path: "/api/admin/applications/:id",
        summary: "Update application status or notes",
        auth: "admin",
        bodyParams: [
          { name: "status", type: "string", description: "UNDER_REVIEW | APPROVED | REJECTED" },
          { name: "adminNotes", type: "string", description: "Internal notes" },
          { name: "rejectionReason", type: "string", description: "Reason shown to applicant on rejection" },
        ],
        curl: `curl -X PUT ${B}/api/admin/applications/app1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"APPROVED","adminNotes":"Verified 2026-08-16"}'`,
      },
      {
        id: "apps-invite",
        method: "POST",
        path: "/api/admin/applications/invite/:id",
        summary: "Send platform invitation to an approved applicant",
        auth: "admin",
        note: "Requires APPROVED status. Sends a time-limited invite link and changes status to INVITED.",
        curl: `curl -X POST ${B}/api/admin/applications/invite/app1 \\
  -H "${CK}"`,
      },
      {
        id: "apps-payment",
        method: "POST",
        path: "/api/admin/applications/payment/:id",
        summary: "Record a manual payment",
        auth: "admin",
        bodyParams: [
          { name: "amount", type: "number", required: true, description: "Amount in dollars" },
          { name: "method", type: "string", required: true, description: "check, wire, cash, etc." },
          { name: "notes", type: "string", description: "Payment reference or notes" },
        ],
        curl: `curl -X POST ${B}/api/admin/applications/payment/app1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":250,"method":"check","notes":"Check #1042"}'`,
      },
      {
        id: "apps-directory",
        method: "PUT",
        path: "/api/admin/applications/directory/:id",
        summary: "Toggle provider directory listing",
        auth: "admin",
        bodyParams: [
          { name: "directoryListed", type: "boolean", required: true, description: "true = visible in provider directory" },
        ],
        curl: `curl -X PUT ${B}/api/admin/applications/directory/app1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"directoryListed":true}'`,
      },
    ],
  },

  // ── Groups ───────────────────────────────────────────────────────────────────
  {
    id: "groups",
    label: "Community Groups",
    description: "Social groups that members can join, post in, and discuss topics. Groups can be PUBLIC or PRIVATE.",
    endpoints: [
      {
        id: "groups-list",
        method: "GET",
        path: "/api/admin/groups",
        summary: "List community groups",
        auth: "admin",
        curl: `curl ${B}/api/admin/groups \\
  -H "${CK}"`,
      },
      {
        id: "groups-create",
        method: "POST",
        path: "/api/admin/groups",
        summary: "Create a group",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Group name" },
          { name: "slug", type: "string", required: true, description: "Unique URL slug" },
          { name: "description", type: "string", description: "Group description" },
          { name: "visibility", type: "string", description: "PUBLIC (default) or PRIVATE" },
          { name: "coverUrl", type: "string", description: "Cloudinary cover image URL" },
        ],
        curl: `curl -X POST ${B}/api/admin/groups \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Mindset and Growth","slug":"mindset-growth","visibility":"PUBLIC"}'`,
      },
      {
        id: "groups-update",
        method: "PATCH",
        path: "/api/admin/groups/:id",
        summary: "Update a group",
        auth: "admin",
        curl: `curl -X PATCH ${B}/api/admin/groups/grp1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"description":"A group about mindset and personal growth."}'`,
      },
      {
        id: "groups-requests",
        method: "PUT",
        path: "/api/admin/groups/:id/requests",
        summary: "Approve or reject join requests",
        auth: "admin",
        bodyParams: [
          { name: "requestId", type: "string", required: true, description: "Join request ID" },
          { name: "action", type: "string", required: true, description: "approve or reject" },
        ],
        curl: `curl -X PUT ${B}/api/admin/groups/grp1/requests \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"requestId":"req1","action":"approve"}'`,
      },
    ],
  },

  // ── Content ──────────────────────────────────────────────────────────────────
  {
    id: "content",
    label: "Content",
    description: "Blog posts, Morning Boost entries, Events, and Resources all follow the same REST pattern. Examples below use /api/admin/blog — substitute morning-boost, events, or resources for the other types.",
    endpoints: [
      {
        id: "content-list",
        method: "GET",
        path: "/api/admin/blog",
        summary: "List blog posts",
        auth: "admin",
        queryParams: [
          { name: "q", type: "string", description: "Search by title" },
          { name: "published", type: "boolean", description: "true = published only, false = drafts only" },
        ],
        curl: `curl ${B}/api/admin/blog \\
  -H "${CK}"`,
      },
      {
        id: "content-create",
        method: "POST",
        path: "/api/admin/blog",
        summary: "Create a blog post",
        auth: "admin",
        bodyParams: [
          { name: "title", type: "string", required: true, description: "Post title" },
          { name: "slug", type: "string", required: true, description: "Unique URL slug" },
          { name: "content", type: "string", description: "HTML or Markdown body" },
          { name: "excerpt", type: "string", description: "Short summary for cards and meta" },
          { name: "imageUrl", type: "string", description: "Cloudinary featured image URL" },
          { name: "category", type: "string", description: "Category label" },
          { name: "authorName", type: "string", description: "Byline" },
          { name: "publishedAt", type: "string", description: "ISO 8601 publish date; null keeps it as a draft" },
        ],
        note: "Use POST /api/admin/blog/upload to get a Cloudinary signed URL before setting imageUrl. The same pattern applies for morning-boost and resources.",
        curl: `curl -X POST ${B}/api/admin/blog \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Five Mindset Habits","slug":"five-mindset-habits","authorName":"Anthony J. Placito","publishedAt":"2026-08-16T10:00:00.000Z"}'`,
      },
      {
        id: "content-update",
        method: "PUT",
        path: "/api/admin/blog/:id",
        summary: "Update a blog post",
        auth: "admin",
        curl: `curl -X PUT ${B}/api/admin/blog/post1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"Updated Title"}'`,
      },
      {
        id: "content-delete",
        method: "DELETE",
        path: "/api/admin/blog/:id",
        summary: "Delete a blog post",
        auth: "admin",
        curl: `curl -X DELETE ${B}/api/admin/blog/post1 \\
  -H "${CK}"`,
      },
      {
        id: "content-upload",
        method: "POST",
        path: "/api/admin/blog/upload",
        summary: "Get a signed Cloudinary upload URL",
        auth: "admin",
        description: "Returns a pre-signed URL and parameters for a direct browser-to-Cloudinary image upload. After upload, the returned secure_url becomes the imageUrl.",
        response: `{
  "uploadUrl": "https://api.cloudinary.com/v1_1/your-cloud/image/upload",
  "signature": "abc123",
  "timestamp": 1700000000,
  "apiKey": "your-api-key",
  "folder": "blog"
}`,
        curl: `curl -X POST ${B}/api/admin/blog/upload \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Products & Gift Codes ────────────────────────────────────────────────────
  {
    id: "products",
    label: "Products & Gift Codes",
    description: "Products and their prices sync to Stripe. Gift codes grant membership access on redemption.",
    endpoints: [
      {
        id: "prod-list",
        method: "GET",
        path: "/api/admin/products",
        summary: "List products",
        auth: "admin",
        curl: `curl ${B}/api/admin/products \\
  -H "${CK}"`,
      },
      {
        id: "prod-create",
        method: "POST",
        path: "/api/admin/products",
        summary: "Create a product",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Product name" },
          { name: "description", type: "string", description: "Description" },
          { name: "imageUrl", type: "string", description: "Cover image URL" },
          { name: "category", type: "string", description: "book, membership, event, etc." },
        ],
        curl: `curl -X POST ${B}/api/admin/products \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Annual Membership","category":"membership"}'`,
      },
      {
        id: "prod-prices",
        method: "POST",
        path: "/api/admin/products/:id/prices",
        summary: "Add a price to a product",
        auth: "admin",
        bodyParams: [
          { name: "amount", type: "number", required: true, description: "Price in cents" },
          { name: "currency", type: "string", description: "Currency code (default usd)" },
          { name: "interval", type: "string", description: "month or year (recurring); omit for one-time" },
          { name: "label", type: "string", description: "Display label (Monthly, Annual, etc.)" },
        ],
        curl: `curl -X POST ${B}/api/admin/products/prod1/prices \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"amount":4900,"currency":"usd","interval":"month","label":"Monthly"}'`,
      },
      {
        id: "prod-stripe-sync",
        method: "POST",
        path: "/api/admin/products/:id/stripe-sync",
        summary: "Sync product and prices to Stripe",
        auth: "admin",
        note: "Creates or updates the Stripe Product and Price objects. Requires STRIPE_SECRET_KEY to be configured.",
        curl: `curl -X POST ${B}/api/admin/products/prod1/stripe-sync \\
  -H "${CK}"`,
      },
      {
        id: "gift-list",
        method: "GET",
        path: "/api/admin/gift-codes",
        summary: "List gift codes",
        auth: "admin",
        queryParams: [
          { name: "used", type: "boolean", description: "Filter by used / unused status" },
        ],
        curl: `curl "${B}/api/admin/gift-codes?used=false" \\
  -H "${CK}"`,
      },
      {
        id: "gift-create",
        method: "POST",
        path: "/api/admin/gift-codes",
        summary: "Generate a batch of gift codes",
        auth: "admin",
        bodyParams: [
          { name: "count", type: "number", required: true, description: "Number to generate (1–1000)" },
          { name: "grantRole", type: "string", required: true, description: "Role granted on redemption (MEMBER)" },
          { name: "expiresAt", type: "string", description: "ISO 8601 expiry; null for no expiry" },
          { name: "notes", type: "string", description: "Internal batch notes" },
        ],
        curl: `curl -X POST ${B}/api/admin/gift-codes \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"count":25,"grantRole":"MEMBER","notes":"Conference 2026"}'`,
      },
    ],
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  {
    id: "settings",
    label: "Settings",
    description: "Key-value settings stored in the database. Used for site-wide configuration including logo URL, site name, and email sender defaults.",
    endpoints: [
      {
        id: "settings-get",
        method: "GET",
        path: "/api/admin/settings",
        summary: "Get all settings",
        auth: "admin",
        response: `{
  "settings": {
    "site_name": "Fixer Nation",
    "site_logo_url": null,
    "morning_boost_from_name": "Fixer Nation",
    "morning_boost_from_email": "noreply@fixernation.org"
  }
}`,
        curl: `curl ${B}/api/admin/settings \\
  -H "${CK}"`,
      },
      {
        id: "settings-update",
        method: "PUT",
        path: "/api/admin/settings",
        summary: "Update a setting",
        auth: "admin",
        bodyParams: [
          { name: "key", type: "string", required: true, description: "Setting key" },
          { name: "value", type: "string", required: true, description: "New value" },
        ],
        note: "One key-value pair per request.",
        curl: `curl -X PUT ${B}/api/admin/settings \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"key":"site_logo_url","value":"https://res.cloudinary.com/fn/logo.png"}'`,
      },
    ],
  },

  // ── Territories ──────────────────────────────────────────────────────────────
  {
    id: "territories",
    label: "Territories",
    description: "Geographic territories for organizing ambassador and provider coverage areas.",
    endpoints: [
      {
        id: "terr-list",
        method: "GET",
        path: "/api/admin/territories",
        summary: "List territories",
        auth: "admin",
        curl: `curl ${B}/api/admin/territories \\
  -H "${CK}"`,
      },
      {
        id: "terr-create",
        method: "POST",
        path: "/api/admin/territories",
        summary: "Create a territory",
        auth: "admin",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Territory name (e.g. Greater Austin)" },
          { name: "state", type: "string", description: "State abbreviation" },
          { name: "region", type: "string", description: "Broader region label" },
        ],
        curl: `curl -X POST ${B}/api/admin/territories \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Greater Austin","state":"TX"}'`,
      },
      {
        id: "terr-update",
        method: "PUT",
        path: "/api/admin/territories/:id",
        summary: "Update or delete a territory",
        auth: "admin",
        note: "Use DELETE to remove. Territories with assigned ambassadors or providers cannot be deleted.",
        curl: `curl -X PUT ${B}/api/admin/territories/terr1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Austin Metro"}'`,
      },
    ],
  },

  // ── Affiliates & Commissions ─────────────────────────────────────────────────
  {
    id: "affiliates",
    label: "Affiliates & Commissions",
    description: "Affiliates are ambassador accounts with commission tracking. Commissions are generated by referrals and reviewed by admins.",
    endpoints: [
      {
        id: "aff-list",
        method: "GET",
        path: "/api/admin/affiliates",
        summary: "List affiliates",
        auth: "admin",
        queryParams: [
          { name: "q", type: "string", description: "Search by name or email" },
        ],
        curl: `curl ${B}/api/admin/affiliates \\
  -H "${CK}"`,
      },
      {
        id: "aff-get",
        method: "GET",
        path: "/api/admin/affiliates/:id",
        summary: "Get an affiliate with commission history",
        auth: "admin",
        curl: `curl ${B}/api/admin/affiliates/aff1 \\
  -H "${CK}"`,
      },
      {
        id: "comm-update",
        method: "PATCH",
        path: "/api/admin/commissions/:id",
        summary: "Approve, reject, or mark a commission paid",
        auth: "admin",
        bodyParams: [
          { name: "status", type: "string", required: true, description: "APPROVED | REJECTED | PAID" },
          { name: "notes", type: "string", description: "Internal note" },
        ],
        curl: `curl -X PATCH ${B}/api/admin/commissions/comm1 \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"APPROVED"}'`,
      },
    ],
  },

  // ── Memberships ──────────────────────────────────────────────────────────────
  {
    id: "memberships",
    label: "Memberships",
    endpoints: [
      {
        id: "memberships-list",
        method: "GET",
        path: "/api/admin/memberships",
        summary: "List active Stripe subscriptions",
        auth: "admin",
        description: "Returns subscription records synced from Stripe. Use the Stripe dashboard for full subscription management.",
        queryParams: [
          { name: "q", type: "string", description: "Search by email or Stripe customer ID" },
          { name: "status", type: "string", description: "active | past_due | canceled | trialing" },
        ],
        curl: `curl "${B}/api/admin/memberships?status=active" \\
  -H "${CK}"`,
      },
    ],
  },

  // ── Provider APIs ────────────────────────────────────────────────────────────
  {
    id: "provider-apis",
    label: "Provider APIs",
    description: "Providers have their own isolated CRM. Provider contacts are completely separate from the platform contact table and cannot be used for FN-originated sends.",
    endpoints: [
      {
        id: "prov-contacts-list",
        method: "GET",
        path: "/api/provider/contacts",
        summary: "List contacts (authenticated provider only)",
        auth: "admin",
        note: "Returns only contacts owned by the authenticated PROVIDER user.",
        curl: `curl ${B}/api/provider/contacts \\
  -H "${CK}"`,
      },
      {
        id: "prov-contacts-create",
        method: "POST",
        path: "/api/provider/contacts",
        summary: "Add a contact to the provider's CRM",
        auth: "admin",
        bodyParams: [
          { name: "email", type: "string", required: true, description: "Contact email" },
          { name: "firstName", type: "string", description: "First name" },
          { name: "lastName", type: "string", description: "Last name" },
          { name: "phone", type: "string", description: "Phone number" },
          { name: "notes", type: "string", description: "Private notes" },
        ],
        curl: `curl -X POST ${B}/api/provider/contacts \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"client@example.com","firstName":"Bob"}'`,
      },
      {
        id: "prov-campaigns-create",
        method: "POST",
        path: "/api/provider/campaigns",
        summary: "Create a provider campaign",
        auth: "admin",
        note: "Provider campaigns can only target the provider's own contacts. FN contact lists are not accessible.",
        bodyParams: [
          { name: "name", type: "string", required: true, description: "Campaign name" },
          { name: "subject", type: "string", required: true, description: "Email subject line" },
          { name: "htmlBody", type: "string", required: true, description: "Email HTML content" },
          { name: "fromEmail", type: "string", required: true, description: "Provider's sender email" },
        ],
        curl: `curl -X POST ${B}/api/provider/campaigns \\
  -H "${CK}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Summer Promo","subject":"Special Offer","htmlBody":"<p>Hello...</p>","fromEmail":"hello@provider.com"}'`,
      },
    ],
  },

  // ── Public APIs ──────────────────────────────────────────────────────────────
  {
    id: "public-apis",
    label: "Public APIs",
    description: "Unauthenticated endpoints for public-facing actions including newsletter subscriptions and one-click unsubscribes from email links.",
    endpoints: [
      {
        id: "pub-subscribe",
        method: "POST",
        path: "/api/public/subscribe",
        summary: "Subscribe to a newsletter topic",
        auth: "public",
        description: "Finds or creates a Contact by email and sets consent for the given topic. Safe to call multiple times for the same email.",
        bodyParams: [
          { name: "email", type: "string", required: true, description: "Subscriber email address" },
          { name: "firstName", type: "string", description: "First name (sets contact name on first subscribe)" },
          { name: "topic", type: "string", required: true, description: "Newsletter topic slug" },
          { name: "source", type: "string", description: "Source context (web-form, landing-page, etc.)" },
        ],
        response: `{"message":"Subscribed successfully.","contactId":"clx1abc"}`,
        curl: `curl -X POST ${B}/api/public/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{"email":"jane@example.com","firstName":"Jane","topic":"monthly-newsletter"}'`,
      },
      {
        id: "pub-unsubscribe",
        method: "GET",
        path: "/api/public/unsubscribe",
        summary: "One-click unsubscribe from an email",
        auth: "public",
        description: "Called via the unsubscribe link in campaign emails. The signed token encodes the contact ID and topic.",
        queryParams: [
          { name: "token", type: "string", required: true, description: "Signed token from the email's unsubscribe link" },
        ],
        response: `{"message":"You have been unsubscribed."}`,
        curl: `curl "${B}/api/public/unsubscribe?token=SIGNED_TOKEN"`,
      },
    ],
  },

  // ── Webhooks ─────────────────────────────────────────────────────────────────
  {
    id: "webhooks",
    label: "Webhooks",
    description: "Inbound webhooks from third-party services. These endpoints do not require a user session but validate request signatures.",
    endpoints: [
      {
        id: "webhook-stripe",
        method: "POST",
        path: "/api/webhooks/stripe",
        summary: "Stripe subscription lifecycle events",
        auth: "public",
        description: "Receives events for subscription creation, updates, and cancellations. Validates the Stripe-Signature header using STRIPE_WEBHOOK_SECRET.",
        note: "Configure this URL in Stripe: Developers > Webhooks. Handled events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.",
        curl: `# Stripe calls this automatically.
# Test locally with the Stripe CLI:
stripe listen --forward-to ${B}/api/webhooks/stripe`,
      },
    ],
  },
];

// ─── Helper Components ────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: HttpMethod }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-bold leading-none ${METHOD_COLORS[method]}`}>
      {method}
    </span>
  );
}

function AuthBadge({ auth }: { auth: AuthLevel }) {
  const meta = AUTH_META[auth];
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold leading-none ${meta.color}`}>
      {meta.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="rounded px-2 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="mt-4 overflow-hidden rounded-lg bg-slate-900 text-sm">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label ?? "Example"}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4 text-[12.5px] leading-relaxed text-slate-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function ParamsTable({ params, label }: { params: Param[]; label: string }) {
  return (
    <div className="mt-4">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left">
              <th className="px-3 py-2 text-[11px] font-semibold text-slate-500">Name</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-slate-500">Type</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-slate-500">Required</th>
              <th className="px-3 py-2 text-[11px] font-semibold text-slate-500">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {params.map((p) => (
              <tr key={p.name} className="hover:bg-slate-50/50">
                <td className="px-3 py-2 font-mono text-[11.5px] font-semibold text-slate-700">{p.name}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{p.type}</td>
                <td className="px-3 py-2 text-[11px]">
                  {p.required
                    ? <span className="font-bold text-red-600">Yes</span>
                    : <span className="text-slate-400">No</span>}
                </td>
                <td className="px-3 py-2 text-[12.5px] leading-relaxed text-slate-600">{p.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EndpointCard({ ep, activeId }: { ep: EndpointDoc; activeId: string }) {
  return (
    <div
      id={ep.id}
      className={`scroll-mt-4 rounded-xl border p-5 transition-colors ${activeId === ep.id ? "border-navy/25 bg-navy/[0.025]" : "border-slate-200 bg-white"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <MethodBadge method={ep.method} />
        <code className="flex-1 font-mono text-[13.5px] font-semibold text-slate-800">{ep.path}</code>
        <AuthBadge auth={ep.auth} />
      </div>
      <h3 className="mt-2 text-[15px] font-bold text-slate-900">{ep.summary}</h3>
      {ep.description && (
        <p className="mt-1 text-[13.5px] leading-relaxed text-slate-500">{ep.description}</p>
      )}
      {ep.note && (
        <div className="mt-3 rounded-lg bg-amber/10 px-3.5 py-2.5 text-[12.5px] text-amber-dark">
          <span className="font-bold">Note: </span>{ep.note}
        </div>
      )}
      {ep.queryParams && ep.queryParams.length > 0 && (
        <ParamsTable params={ep.queryParams} label="Query Parameters" />
      )}
      {ep.bodyParams && ep.bodyParams.length > 0 && (
        <ParamsTable params={ep.bodyParams} label="Request Body" />
      )}
      {ep.response && <CodeBlock code={ep.response} label="Response" />}
      {ep.curl && <CodeBlock code={ep.curl} label="curl" />}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DevelopersPage: NextPageWithLayout = () => {
  const [activeId, setActiveId] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll("section[id]"));
    const endpoints = Array.from(document.querySelectorAll("[data-endpoint-anchor]"));
    const targets = [...sections, ...endpoints];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveId(e.target.id);
        }
      },
      { rootMargin: "-56px 0px -72% 0px", threshold: 0 }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const lower = search.toLowerCase();
  const filtered = search
    ? SPEC.map((g) => ({
        ...g,
        endpoints: g.endpoints.filter(
          (ep) =>
            ep.path.toLowerCase().includes(lower) ||
            ep.summary.toLowerCase().includes(lower) ||
            ep.method.toLowerCase().includes(lower)
        ),
      })).filter(
        (g) =>
          g.label.toLowerCase().includes(lower) ||
          (g.description ?? "").toLowerCase().includes(lower) ||
          g.endpoints.length > 0
      )
    : SPEC;

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 16;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <>
      <Head>
        <title>API Reference — Fixer Nation</title>
        <meta name="description" content="Fixer Nation REST API reference for internal and external developers." />
      </Head>

      <div className="flex min-h-screen bg-white text-slate-900 antialiased">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <aside className="fixed inset-y-0 left-0 z-20 flex w-[268px] flex-col border-r border-slate-200 bg-white">
          {/* Logo */}
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
            <Link href="/" className="flex items-center gap-2 no-underline">
              <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-navy font-extrabold text-amber text-sm leading-none">
                ✓
              </span>
              <div>
                <div className="text-[14px] font-extrabold leading-tight text-navy">Fixer Nation</div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">API Reference</div>
              </div>
            </Link>
          </div>

          {/* Search */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search endpoints..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] placeholder-slate-400 focus:border-navy/30 focus:outline-none focus:ring-1 focus:ring-navy/20"
            />
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-2 py-2 text-[13px]">
            {filtered.map((g) => {
              const isOpen = !collapsed[g.id];
              const groupIsActive =
                activeId === g.id || g.endpoints.some((ep) => ep.id === activeId);
              return (
                <div key={g.id} className="mb-0.5">
                  <button
                    onClick={() =>
                      g.endpoints.length === 0 ? scrollTo(g.id) : toggleGroup(g.id)
                    }
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left font-semibold transition-colors ${
                      groupIsActive
                        ? "bg-navy/8 text-navy"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <span>{g.label}</span>
                    {g.endpoints.length > 0 && (
                      <svg
                        className={`h-3 w-3 flex-shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>

                  {isOpen &&
                    g.endpoints.map((ep) => (
                      <button
                        key={ep.id}
                        onClick={() => scrollTo(ep.id)}
                        className={`ml-3 flex w-[calc(100%-12px)] items-center gap-2 rounded-md px-2 py-[5px] text-left text-[12px] transition-colors ${
                          activeId === ep.id
                            ? "bg-navy/8 text-navy"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        <span
                          className={`w-[38px] flex-shrink-0 rounded px-1 py-0.5 text-center font-mono text-[9px] font-bold leading-tight ${METHOD_COLORS[ep.method]}`}
                        >
                          {ep.method}
                        </span>
                        <span className="min-w-0 truncate font-mono text-[11px]">
                          {ep.path
                            .replace(/\/api\/(admin\/|public\/|provider\/|webhooks\/|auth\/)?/, "")
                            .replace(/\/:id/g, "/:id")}
                        </span>
                      </button>
                    ))}
                </div>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t border-slate-100 px-5 py-3">
            <Link href="/" className="text-[12px] text-slate-400 no-underline hover:text-navy">
              ← Back to fixernation.org
            </Link>
          </div>
        </aside>

        {/* ── Main ────────────────────────────────────────────────────────── */}
        <main className="ml-[268px] min-h-screen flex-1 bg-slate-50/30">
          <div className="mx-auto max-w-3xl px-8 py-12">
            {/* Hero */}
            <div className="mb-14">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Developer Reference</p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-navy">API Reference</h1>
              <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-slate-500">
                Full reference for the Fixer Nation REST API — built for both internal admin use and external integrations.
                Base URL:{" "}
                <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[12px] text-slate-700">
                  {B}
                </code>
              </p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {[
                  ["Auth", "NextAuth session cookie"],
                  ["Format", "JSON"],
                  ["Versioning", "None (latest)"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[13px] shadow-sm"
                  >
                    <span className="text-slate-400">{k}:</span>
                    <span className="font-semibold text-slate-700">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sections */}
            {filtered.map((g) => (
              <section key={g.id} id={g.id} className="mb-16 scroll-mt-4">
                <h2 className="mb-2 text-2xl font-extrabold tracking-tight text-slate-900">{g.label}</h2>
                {g.description && (
                  <p className="mb-7 text-[14.5px] leading-relaxed text-slate-500">{g.description}</p>
                )}
                {g.endpoints.length > 0 && (
                  <div className="space-y-4">
                    {g.endpoints.map((ep) => (
                      <div key={ep.id} id={ep.id} data-endpoint-anchor>
                        <EndpointCard ep={ep} activeId={activeId} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <div className="border-t border-slate-200 pt-10 pb-4 text-center text-[12px] text-slate-400">
              Fixer Nation API Reference &mdash; for support contact{" "}
              <a href="mailto:admin@fixernation.org" className="text-navy underline">
                admin@fixernation.org
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
};

DevelopersPage.getLayout = (page) => page;
export default DevelopersPage;
