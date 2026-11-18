import { LightningElement, api, wire } from "lwc";
import { getRecord, notifyRecordUpdateAvailable } from "lightning/uiRecordApi";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import { NavigationMixin } from "lightning/navigation";

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;

function displayName(apiName) {
  return apiName
    .replace(/__(c|pc|r)$/i, "")
    .replace(/_/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

export default class RecordReadinessChecker extends NavigationMixin(
  LightningElement
) {
  @api recordId;
  @api objectApiName;
  @api title = "Record Readiness";
  @api fieldsCsv = "Name,CloseDate,StageName,Amount,Description";

  recordData;
  recordError;
  refreshing = false;
  refreshError;

  @wire(getObjectInfo, { objectApiName: "$objectApiName" })
  objectInfo;

  get names() {
    return (this.fieldsCsv || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }

  get configurationError() {
    const names = this.names;
    if (names.length !== 5)
      return "Configure exactly five comma-separated field API names.";
    if (new Set(names.map((name) => name.toLowerCase())).size !== 5)
      return "Each of the five field names must be unique.";
    if (!names.every((name) => IDENTIFIER.test(name)))
      return "Use direct field API names only (no relationship paths).";
    return null;
  }

  // Required Id query ensures that the record is accessible. Optional configured
  // fields are omitted by UI API if the user lacks field-level access.
  get requiredFields() {
    if (!this.recordId || !this.objectApiName || this.configurationError)
      return undefined;
    return [`${this.objectApiName}.Id`];
  }

  get optionalFields() {
    if (!this.requiredFields) return undefined;
    return this.names.map((name) => `${this.objectApiName}.${name}`);
  }

  @wire(getRecord, {
    recordId: "$recordId",
    fields: "$requiredFields",
    optionalFields: "$optionalFields"
  })
  wiredRecord({ data, error }) {
    this.recordData = data;
    this.recordError = error;
  }

  get loading() {
    return Boolean(
      this.recordId &&
      this.objectApiName &&
      !this.configurationError &&
      !this.recordData &&
      !this.recordError
    );
  }

  get message() {
    if (!this.recordId || !this.objectApiName)
      return "Place this component on a Salesforce record page.";
    if (this.configurationError) return this.configurationError;
    if (this.recordError)
      return "Unable to read this record or its configured fields. Check the object, field names and your permissions.";
    return this.refreshError;
  }

  get rows() {
    if (!this.recordData || this.configurationError || this.recordError)
      return [];
    return this.names.map((name, index) => {
      const field = this.recordData.fields?.[name];
      const accessible = field !== undefined;
      const value = accessible ? field.value : null;
      const passed =
        accessible &&
        value !== null &&
        value !== undefined &&
        (typeof value !== "string" || value.trim().length > 0) &&
        (!Array.isArray(value) || value.length > 0);
      return {
        key: name,
        label:
          this.objectInfo?.data?.fields?.[name]?.label || displayName(name),
        number: index + 1,
        passed,
        iconName: passed ? "utility:success" : "utility:warning",
        iconVariant: passed ? "success" : "warning",
        detail: !accessible
          ? "Unavailable: no field access or field not returned"
          : passed
            ? "Complete"
            : "Missing value"
      };
    });
  }

  get passedCount() {
    return this.rows.filter((row) => row.passed).length;
  }
  get percent() {
    return this.rows.length ? this.passedCount * 20 : 0;
  }
  get ready() {
    return this.rows.length === 5 && this.passedCount === 5;
  }
  get overallStatus() {
    return this.ready ? "Ready" : "Incomplete";
  }
  get hasRows() {
    return this.rows.length === 5;
  }
  get busy() {
    return this.loading || this.refreshing;
  }
  get loadingText() {
    return this.refreshing ? "Refreshing readiness" : "Loading readiness";
  }
  get showActions() {
    return Boolean(
      this.requiredFields && (this.recordData || this.recordError)
    );
  }
  get refreshLabel() {
    return this.refreshing
      ? "Refreshing…"
      : this.recordError
        ? "Retry"
        : "Refresh";
  }
  get disableRefresh() {
    return !this.showActions || this.busy;
  }
  get showEdit() {
    return this.hasRows && this.objectInfo?.data?.updateable === true;
  }

  handleEdit() {
    if (!this.showEdit || this.busy) return;
    this[NavigationMixin.Navigate]({
      type: "standard__recordPage",
      attributes: {
        recordId: this.recordId,
        objectApiName: this.objectApiName,
        actionName: "edit"
      }
    });
  }

  async handleRefresh() {
    if (this.disableRefresh) return;
    this.refreshing = true;
    this.refreshError = undefined;
    try {
      await notifyRecordUpdateAvailable([{ recordId: this.recordId }]);
    } catch {
      this.refreshError =
        "Refresh failed. Try again or reload the record page.";
    } finally {
      this.refreshing = false;
    }
  }
}
