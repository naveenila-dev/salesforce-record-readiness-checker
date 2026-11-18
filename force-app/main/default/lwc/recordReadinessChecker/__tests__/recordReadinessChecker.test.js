import { createElement } from "lwc";
import RecordReadinessChecker from "c/recordReadinessChecker";
import { getRecord, notifyRecordUpdateAvailable } from "lightning/uiRecordApi";
import { getObjectInfo } from "lightning/uiObjectInfoApi";
import { navigateMock } from "lightning/navigation";

jest.mock("lightning/navigation", () => {
  const navigate = Symbol("Navigate");
  const navigationSpy = jest.fn();
  const NavigationMixin = (Base) =>
    class extends Base {
      [navigate](pageReference) {
        navigationSpy(pageReference);
      }
    };
  NavigationMixin.Navigate = navigate;
  return { NavigationMixin, navigateMock: navigationSpy };
});

jest.mock("lightning/uiRecordApi", () => {
  const original = jest.requireActual("lightning/uiRecordApi");
  return { ...original, notifyRecordUpdateAvailable: jest.fn() };
});

const RECORD_ID = "006000000000001AAA";
const record = {
  apiName: "Opportunity",
  id: RECORD_ID,
  fields: {
    Name: { value: "Example" },
    CloseDate: { value: "2026-12-01" },
    StageName: { value: "Prospecting" },
    Amount: { value: 0 },
    Description: { value: null }
  }
};
const objectInfo = {
  apiName: "Opportunity",
  updateable: true,
  fields: { Name: { label: "Opportunity Name" } }
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

function mount() {
  const element = createElement("c-record-readiness-checker", {
    is: RecordReadinessChecker
  });
  element.recordId = RECORD_ID;
  element.objectApiName = "Opportunity";
  document.body.appendChild(element);
  return element;
}

function button(element, label) {
  return [...element.shadowRoot.querySelectorAll("lightning-button")].find(
    (item) => item.label === label
  );
}

describe("c-record-readiness-checker", () => {
  afterEach(() => {
    while (document.body.firstChild) {
      document.body.removeChild(document.body.firstChild);
    }
    jest.resetAllMocks();
  });

  it("uses field labels and announces completion changes", async () => {
    const element = mount();
    getRecord.emit(record);
    getObjectInfo.emit(objectInfo);
    await flush();

    const summary = element.shadowRoot.querySelector('[aria-live="polite"]');
    expect(summary.getAttribute("aria-atomic")).toBe("true");
    expect(summary.textContent).toContain("4 of 5 complete (80%)");
    expect(element.shadowRoot.querySelector("li").textContent).toContain(
      "Opportunity Name"
    );

    getRecord.emit({
      ...record,
      fields: { ...record.fields, Description: { value: "Complete" } }
    });
    await flush();
    expect(summary.textContent).toContain("Ready");
    expect(summary.textContent).toContain("5 of 5 complete (100%)");
  });

  it("keeps readable labels and the checklist when metadata fails", async () => {
    const element = mount();
    getRecord.emit(record);
    getObjectInfo.error();
    await flush();

    expect(element.shadowRoot.querySelectorAll("li")).toHaveLength(5);
    expect(element.shadowRoot.querySelector("ul").textContent).toContain(
      "Close Date"
    );
    expect(button(element, "Edit record")).toBeUndefined();
  });

  it("allows retry after an initial read error and shows refresh feedback", async () => {
    let finishRefresh;
    notifyRecordUpdateAvailable.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRefresh = resolve;
        })
    );
    const element = mount();
    getRecord.error();
    await flush();

    expect(button(element, "Retry").disabled).toBe(false);
    button(element, "Retry").click();
    await flush();

    expect(notifyRecordUpdateAvailable).toHaveBeenCalledWith([
      { recordId: RECORD_ID }
    ]);
    expect(button(element, "Refreshing…").disabled).toBe(true);
    expect(
      element.shadowRoot.querySelector("lightning-spinner").alternativeText
    ).toBe("Refreshing readiness");
    expect(
      element.shadowRoot.querySelector("[aria-busy]").getAttribute("aria-busy")
    ).toBe("true");

    getRecord.emit(record);
    finishRefresh();
    await flush();
    expect(button(element, "Refresh").disabled).toBe(false);
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
    expect(element.shadowRoot.querySelector("lightning-spinner")).toBeNull();
  });

  it("recovers from a rejected refresh without losing the checklist", async () => {
    notifyRecordUpdateAvailable.mockRejectedValue(new Error("Offline"));
    const element = mount();
    getRecord.emit(record);
    await flush();
    button(element, "Refresh").click();
    await flush();

    expect(
      element.shadowRoot.querySelector('[role="alert"]').textContent
    ).toContain("Refresh failed");
    expect(button(element, "Refresh").disabled).toBe(false);
    expect(element.shadowRoot.querySelectorAll("li")).toHaveLength(5);

    notifyRecordUpdateAvailable.mockResolvedValue();
    button(element, "Refresh").click();
    await flush();
    expect(element.shadowRoot.querySelector('[role="alert"]')).toBeNull();
  });

  it("opens the current record editor", async () => {
    const element = mount();
    getRecord.emit(record);
    getObjectInfo.emit(objectInfo);
    await flush();
    button(element, "Edit record").click();

    expect(navigateMock).toHaveBeenCalledWith({
      type: "standard__recordPage",
      attributes: {
        recordId: RECORD_ID,
        objectApiName: "Opportunity",
        actionName: "edit"
      }
    });
  });

  it("hides editing for an object without update access", async () => {
    const element = mount();
    getRecord.emit(record);
    getObjectInfo.emit({ ...objectInfo, updateable: false });
    await flush();
    expect(button(element, "Edit record")).toBeUndefined();
    expect(button(element, "Refresh")).toBeDefined();
  });

  it("does not offer retry for invalid configuration", async () => {
    const element = mount();
    element.fieldsCsv = "Name";
    await flush();
    expect(
      element.shadowRoot.querySelector('[role="alert"]').textContent
    ).toContain("exactly five");
    expect(element.shadowRoot.querySelector("lightning-button")).toBeNull();
    expect(notifyRecordUpdateAvailable).not.toHaveBeenCalled();
  });
});
