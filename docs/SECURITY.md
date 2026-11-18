# Security model

This MVP reads readiness through Salesforce `getRecord` from `lightning/uiRecordApi` and field labels through `getObjectInfo`.

The Edit record action opens Salesforce's record editor when object metadata indicates update access. Salesforce enforces record access, field permissions, and validation when editing; the checklist itself does not write record data.

- No Apex, SOQL, DML, callouts, persistent local storage or credentials.
- Relies on Lightning Data Service / UI API to respect record and field-level access.
- Queries `ObjectApiName.Id` as a required field and the five configured fields as optional fields.
- Missing optional fields are labeled unavailable and are never treated as passed.
- Never displays raw field values or exports them.
- Avoid using informational UI readiness as a substitute for enforcement, business validation, or server-side authorization.
- Admins should use App Builder controls to configure the five fields; users with broad setup privileges can change the definition of "ready".
- Prior to AppExchange release, conduct org testing, review dependency/licensing requirements, and follow the Salesforce security review process.

Known limitation: Because optional fields can be omitted for multiple reasons, the UI cannot always distinguish missing access from an invalid field. The message is intentionally cautious.
