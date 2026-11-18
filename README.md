# Record Readiness Checker for Salesforce

A small, open-source Lightning Web Component (LWC) that checks whether **exactly five configured fields** on a Salesforce record contain values. It displays a live progress bar, a per-field status, and a refresh button. The same component works on **Opportunity** and **supported custom object** record pages.

> **MVP:** One LWC. No Apex, Custom Metadata Types, custom permissions, external APIs, storage, or callouts. Designed for simple internal workflows and as a starting point for an unlocked/managed Salesforce package.

## Contents

- [Features](#features)
- [What it looks like](#what-it-looks-like)
- [Prerequisites](#prerequisites)
- [Install from GitHub source](#install-from-github-source)
- [Configure on an Opportunity](#configure-on-an-opportunity)
- [Configure on a custom object](#configure-on-a-custom-object)
- [How field completion works](#how-field-completion-works)
- [Security and limitations](#security-and-limitations)
- [Test plan](#test-plan)
- [Unlocked 2GP packaging](#unlocked-2gp-packaging)
- [Managed 2GP / AppExchange path](#managed-2gp--appexchange-path)
- [Troubleshooting](#troubleshooting)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)

## Features

- Configure five field API names in **Lightning App Builder**, with no code changes.
- Display completion count (0–5), percentage and progress bar.
- Identify missing values and fields unavailable to the current user.
- Refresh the underlying Lightning Data Service record data without reloading the entire page.
- Use the same component on different record pages, including custom objects supported by Salesforce UI API.
- Read-only; the component does not save or modify records.
- Use standard Lightning base components and Salesforce data access.

## What it looks like

Example when three of five fields are complete:

```text
+---------------------------------------------+
|  Record Readiness                           |
|  Incomplete               3 of 5 (60%)      |
|  [############------------]                 |
|  ✓ 1. Name                 Complete         |
|  ✓ 2. Close Date           Complete         |
|  ✓ 3. Stage Name           Complete         |
|  ! 4. Amount               Missing value    |
|  ! 5. Description          Missing value    |
|                                             |
|  [Refresh]                                  |
+---------------------------------------------+
```

## Prerequisites

- A Salesforce org that supports Lightning Web Components, Lightning record pages, and UI API for the selected object.
- A Salesforce developer/administrator with permission to deploy source and edit Lightning pages.
- **Salesforce CLI** (`sf`) and a working org login.
- Node.js is optional for deployment; install it if adding Jest-based automated tests.
- API version 65.0 or newer; adjust `sfdx-project.json` and component metadata if your org needs another supported version.

## Install from GitHub source

1. Download or clone this project to your development machine.
2. Open a terminal in the project directory.
3. Log in to a development org or sandbox (replace the login URL if needed):

   ```bash
   sf org login web --alias rrc-dev --instance-url https://test.salesforce.com
   ```

   For a Developer Edition or production login, use `https://login.salesforce.com` instead.

4. Deploy:

   ```bash
   sf project deploy start --source-dir force-app --target-org rrc-dev
   ```

5. Confirm deployment:

   ```bash
   sf project deploy report --target-org rrc-dev
   ```

6. Go to **Setup → Lightning App Builder**, or open an Opportunity and choose **Edit Page** from the setup gear.
7. Drag **Record Readiness Checker** onto the record page, set its properties, **Save**, and **Activate** the page if necessary.

No post-install Apex permission set is necessary because this MVP contains no Apex. Users still need appropriate access to the records and configured fields.

## Configure on an Opportunity

Open an Opportunity Lightning record page in App Builder. Set:

| Component property | Value |
|---|---|
| Checklist title | `Opportunity Readiness` |
| Five field API names | `Name,CloseDate,StageName,Amount,Description` |

This means the checker considers an Opportunity **ready** if all five fields have non-empty values. It **does not** verify whether the opportunity is in a desirable business stage, or whether amounts are above zero.

> Salesforce normally requires Opportunity Name, Stage and Close Date. Amount and Description are useful examples of optional fields. The component will still check all five independently.

## Configure on a custom object

Create (or use) an object supported by Salesforce UI API, for example `Project_Request__c`, with these fields:

| Label | API name | Type |
|---|---|---|
| Name | `Name` | Standard record name |
| Requester Email | `Requester_Email__c` | Email |
| Requested On | `Requested_On__c` | Date |
| Status | `Status__c` | Picklist |
| Consent Confirmed | `Consent_Confirmed__c` | Checkbox |

1. Open the custom object's **Lightning Record Page** in App Builder.
2. Add **Record Readiness Checker**.
3. Set title to `Request Readiness`.
4. Set five field names to:

   ```text
   Name,Requester_Email__c,Requested_On__c,Status__c,Consent_Confirmed__c
   ```

5. Save, activate and open a record.

**Note:** A checkbox set to `false` is considered populated by this MVP. This app checks presence, not whether a checkbox was checked. Use a future typed rule engine for `IS_TRUE` conditions.

## How field completion works

The component receives `recordId` and `objectApiName` automatically from its Lightning record-page context. It constructs fully qualified field names and uses `@wire(getRecord)` to read the record from Salesforce UI API.

- `null`, `undefined`, an empty string, and whitespace-only strings **fail**.
- Numeric `0`, boolean `false`, non-empty strings, dates and other present values **pass**.
- Fields omitted because of field-level security or other UI API omissions are **unavailable**, not passed.
- Exactly **five distinct, direct** field API names are required; relationship paths like `Account.Owner.Name` are not supported.
- Permission failures or invalid field configuration do not produce a green/ready result.
- A complete result means **5/5 fields have values**, not that a business approval was granted.

The current version does not expose field values. It displays only the field name and result. Field names are formatted for display (for example, `CloseDate` → `Close Date`).

### Refresh behavior

Use the **Refresh** button after editing the record. It calls `notifyRecordUpdateAvailable([{ recordId }])`, which notifies Lightning Data Service that the current record may have changed. Many standard LDS edits also update the wired data automatically. For unsupported external updates, refresh may depend on Salesforce's LDS behavior; reloading the page is a fallback.

## Security and limitations

**Security**

- `getRecord` runs in the current Salesforce user's access context, applying sharing and field-level access supported by Salesforce UI API.
- The five requested fields are passed as `optionalFields`: inaccessible fields are omitted rather than returned to JavaScript.
- The component requests the record's `Id` as a required field; a record that cannot be read produces a controlled error message.
- It never performs DML, Apex, dynamic SOQL, external callouts or local data persistence.
- It does not expose raw values in its rendered checklist.
- **Do not use the displayed “Ready” state as authorization, regulatory validation or a server-side gate.** It's an informational UI helper only.

**Limitations of v1.0**

- Exactly five fields; not 3, 10 or conditional rules.
- Presence checks only. No `EQUALS`, `IS_TRUE`, ranges, or related-list existence checks.
- Direct fields only; no nested relationship paths.
- Fields must be valid for the selected object and supported by UI API.
- No field labels fetched from Salesforce metadata; the component generates simple names from API names.
- No org-wide enforcement, approvals, validation rules, record save blocking or write operations.
- The sample custom object is **not** created by the package; you configure one you already have or create it manually.
- No localization or translation framework beyond Salesforce base component behavior.

## Test plan

Run these manual acceptance tests in a sandbox or scratch org:

| Test | Action | Expected result |
|---|---|---|
| 1 | Deploy and add to Opportunity page | Component renders |
| 2 | Configure valid five Opportunity fields | Five rows display |
| 3 | Blank Amount and Description | 3/5 (60%) when other three are set |
| 4 | Fill those fields; click Refresh | 5/5 (100%), Ready |
| 5 | Provide four field names | Visible configuration error; not Ready |
| 6 | Repeat a field name | Visible configuration error; not Ready |
| 7 | Enter `Account.Name` | Visible configuration error |
| 8 | Revoke read access to one configured field | Rule is Unavailable; never Ready |
| 9 | Use an invalid field name | Error or unavailable state; never Ready |
| 10 | Navigate to another record | Readiness reflects the active record |
| 11 | Configure a custom object | The same LWC works without Apex changes |
| 12 | Set checkbox to false | Considered populated, as documented |

Automated Jest tests are recommended before wider release; this starter release does **not** claim that Jest, scratch-org CI, or live-org integration tests have already passed.

## Unlocked 2GP packaging

An unlocked package is useful for source-friendly installations and reproducible releases. **Dev Hub must be enabled**, and you need a packaging-enabled org. A package may need its package ID added as an alias in `sfdx-project.json` after creation.

```bash
sf package create \
  --name RecordReadinessChecker \
  --package-type Unlocked \
  --path force-app \
  --target-dev-hub YOUR_DEV_HUB_ALIAS

sf package version create \
  --package RecordReadinessChecker \
  --installation-key-bypass \
  --target-dev-hub YOUR_DEV_HUB_ALIAS \
  --wait 20

sf package version list --target-dev-hub YOUR_DEV_HUB_ALIAS
```

After creating a version, install it using its returned `04t...` version ID:

```bash
sf package install \
  --package 04tYOUR_PACKAGE_VERSION_ID \
  --target-org YOUR_TARGET_ORG_ALIAS \
  --wait 20 \
  --publish-wait 20
```

**Avoid publishing generated package IDs in README examples** until you have a real, successfully created version.

## Managed 2GP / AppExchange path

A managed 2GP release requires appropriate Salesforce partner/packaging setup and a registered/linked namespace. It is **not** an in-place conversion of an unlocked package; create a separate managed package identity.

```bash
sf package create \
  --name RecordReadinessCheckerManaged \
  --package-type Managed \
  --path force-app \
  --target-dev-hub YOUR_DEV_HUB_ALIAS
```

Before a marketplace listing, plan for namespace testing, package versioning, partner onboarding, security review, accessibility, documentation, and support. The lack of Apex does not automatically waive marketplace requirements. Read the current Salesforce ISV/security review documentation before submission.

## Troubleshooting

**Component is not visible in App Builder:** Confirm source deployment succeeded, the LWC file is exposed on `lightning__RecordPage`, and the current page is a Lightning record page.

**“Place this component on a Salesforce record page”:** `recordId` or `objectApiName` has not been supplied by the page context. Do not use this LWC on a general App page without modifications.

**Configuration error:** Provide exactly five unique direct field API names, separated by commas. Use API names, not labels.

**Unavailable field:** Verify the object's field API name and the user's field-level access. Check whether the field is supported by Salesforce UI API.

**Data did not refresh:** Save the edited record first, click Refresh, and if necessary reload the record page.

**Unexpected false checkbox result:** `false` is non-null and therefore counts as populated by design; this app is not a boolean compliance checker.

## Project structure

```text
record-readiness-checker/
├── force-app/main/default/lwc/recordReadinessChecker/
│   ├── recordReadinessChecker.html
│   ├── recordReadinessChecker.js
│   └── recordReadinessChecker.js-meta.xml
├── docs/
│   └── SECURITY.md
├── .gitignore
├── LICENSE
├── README.md
└── sfdx-project.json
```

## Roadmap

- **v1.0:** Five direct-field presence checks; native LWC; Opportunity and custom object usage.
- **v1.1:** True/false and equals operators, proper field labels via metadata, Jest tests, CI workflow.
- **v1.2:** Optional Custom Metadata administration and configurable rule count.
- **v2.0:** Apex service and server-side enforcement only if a real workflow requires it.

## Official documentation

- [Salesforce `getRecord` wire adapter](https://developer.salesforce.com/docs/platform/lwc/guide/reference-wire-adapters-record)
- [Record page target configuration](https://developer.salesforce.com/docs/platform/lwc/guide/targets-lightning-record-page.html)
- [Record page object context](https://developer.salesforce.com/docs/platform/lwc/guide/use-object-context.html)
- [Notify record update available](https://developer.salesforce.com/docs/platform/lwc/guide/reference-notify-record-update.html)
- [Salesforce CLI package commands](https://developer.salesforce.com/docs/platform/salesforce-cli-reference/guide/cli_reference_package.html)
- [Second-generation packaging](https://developer.salesforce.com/docs/platform/pkg2-dev/guide/sfdx-dev-dev2gp.html)

## License

MIT; see [LICENSE](LICENSE). Before publishing, replace the placeholder copyright attribution as appropriate and confirm that you own the code and have the right to release it.
