import { router } from "@inertiajs/react";
import axios from "axios";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TaskTemplate } from "@/types";
import type { TaskTemplateFormData } from "./types";

const EMPTY_TEMPLATE_FORM: TaskTemplateFormData = {
    name: "",
    description_template: "",
    priority: "none",
    effort_estimate: "",
};

export function useTaskTemplates(teamSlug: string) {
    const [taskTemplates, setTaskTemplates] = useState<TaskTemplate[]>([]);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    /** Template being edited; null while creating a new one. */
    const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(
        null,
    );
    const [templateFormData, setTemplateFormData] =
        useState<TaskTemplateFormData>(EMPTY_TEMPLATE_FORM);
    const [templateFormErrors, setTemplateFormErrors] = useState<
        Record<string, string>
    >({});
    const [savingTaskTemplate, setSavingTaskTemplate] = useState(false);
    const [pendingDelete, setPendingDelete] = useState<TaskTemplate | null>(
        null,
    );
    const [deletingTemplate, setDeletingTemplate] = useState(false);
    const busyRef = useRef(false);

    const fetchTemplates = useCallback(
        (signal?: AbortSignal) => {
            setLoadError(false);
            return axios
                .get(route("teams.task-templates.index", teamSlug), { signal })
                .then(({ data }) => {
                    setTaskTemplates(data as TaskTemplate[]);
                    setLoadingTemplates(false);
                })
                .catch((error) => {
                    if (axios.isCancel(error)) return;
                    setLoadError(true);
                    setLoadingTemplates(false);
                });
        },
        [teamSlug],
    );

    useEffect(() => {
        const controller = new AbortController();
        setLoadingTemplates(true);
        void fetchTemplates(controller.signal);

        return () => controller.abort();
    }, [fetchTemplates]);

    const resetTemplateForm = () => {
        setShowTemplateForm(false);
        setEditingTemplate(null);
        setTemplateFormData(EMPTY_TEMPLATE_FORM);
        setTemplateFormErrors({});
    };

    const openCreateForm = () => {
        setEditingTemplate(null);
        setTemplateFormData(EMPTY_TEMPLATE_FORM);
        setTemplateFormErrors({});
        setShowTemplateForm(true);
    };

    const openEditForm = (template: TaskTemplate) => {
        setEditingTemplate(template);
        setTemplateFormData({
            name: template.name,
            description_template: template.description_template ?? "",
            priority: template.priority ?? "none",
            effort_estimate: template.effort_estimate ?? "",
        });
        setTemplateFormErrors({});
        setShowTemplateForm(true);
    };

    const handleTemplateFieldChange = <
        Field extends keyof TaskTemplateFormData,
    >(
        field: Field,
        value: TaskTemplateFormData[Field],
    ) => {
        setTemplateFormData((prev) => ({ ...prev, [field]: value }));
    };

    const handleSubmitTemplate = () => {
        if (!templateFormData.name.trim()) {
            setTemplateFormErrors({ name: "Name is required." });
            return;
        }
        if (busyRef.current) return;
        busyRef.current = true;

        setSavingTaskTemplate(true);
        setTemplateFormErrors({});

        const payload = {
            name: templateFormData.name.trim(),
            description_template: templateFormData.description_template || null,
            priority: templateFormData.priority,
            effort_estimate:
                templateFormData.effort_estimate === ""
                    ? null
                    : Number(templateFormData.effort_estimate),
        };

        const options = {
            preserveScroll: true,
            onSuccess: () => {
                resetTemplateForm();
                void fetchTemplates();
            },
            onError: (errors: Record<string, string>) => {
                setTemplateFormErrors(errors);
            },
            onFinish: () => {
                busyRef.current = false;
                setSavingTaskTemplate(false);
            },
        };

        if (editingTemplate) {
            router.put(
                route("teams.task-templates.update", [
                    teamSlug,
                    editingTemplate.id,
                ]),
                payload,
                options,
            );
        } else {
            router.post(
                route("teams.task-templates.store", teamSlug),
                payload,
                options,
            );
        }
    };

    const confirmDeleteTemplate = () => {
        const template = pendingDelete;
        if (!template || busyRef.current) return;
        busyRef.current = true;
        setDeletingTemplate(true);

        router.delete(
            route("teams.task-templates.destroy", [teamSlug, template.id]),
            {
                preserveScroll: true,
                onSuccess: () => {
                    setTaskTemplates((prev) =>
                        prev.filter((t) => t.id !== template.id),
                    );
                    if (editingTemplate?.id === template.id) {
                        resetTemplateForm();
                    }
                },
                onFinish: () => {
                    busyRef.current = false;
                    setDeletingTemplate(false);
                    setPendingDelete(null);
                },
            },
        );
    };

    return {
        loadingTemplates,
        loadError,
        savingTaskTemplate,
        showTemplateForm,
        editingTemplate,
        taskTemplates,
        templateFormData,
        templateFormErrors,
        pendingDelete,
        deletingTemplate,
        retryLoad: () => {
            setLoadingTemplates(true);
            void fetchTemplates();
        },
        handleSubmitTemplate,
        handleTemplateFieldChange,
        openCreateForm,
        openEditForm,
        resetTemplateForm,
        requestDeleteTemplate: setPendingDelete,
        cancelDeleteTemplate: () => setPendingDelete(null),
        confirmDeleteTemplate,
    };
}
