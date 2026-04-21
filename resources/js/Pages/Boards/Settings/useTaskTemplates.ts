import { router } from "@inertiajs/react";
import axios from "axios";
import { useEffect, useState } from "react";
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
    const [showTemplateForm, setShowTemplateForm] = useState(false);
    const [templateFormData, setTemplateFormData] =
        useState<TaskTemplateFormData>(EMPTY_TEMPLATE_FORM);
    const [templateFormErrors, setTemplateFormErrors] = useState<
        Record<string, string>
    >({});
    const [savingTaskTemplate, setSavingTaskTemplate] = useState(false);

    useEffect(() => {
        const controller = new AbortController();

        axios
            .get(route("teams.task-templates.index", teamSlug), {
                signal: controller.signal,
            })
            .then(({ data }) => {
                setTaskTemplates(data as TaskTemplate[]);
                setLoadingTemplates(false);
            })
            .catch((error) => {
                if (!axios.isCancel(error)) {
                    setLoadingTemplates(false);
                }
            });

        return () => controller.abort();
    }, [teamSlug]);

    const resetTemplateForm = () => {
        setShowTemplateForm(false);
        setTemplateFormData(EMPTY_TEMPLATE_FORM);
        setTemplateFormErrors({});
    };

    const handleTemplateFieldChange = <
        Field extends keyof TaskTemplateFormData,
    >(
        field: Field,
        value: TaskTemplateFormData[Field],
    ) => {
        setTemplateFormData((prev) => ({ ...prev, [field]: value }));
    };

    const fetchTemplates = () => {
        return axios
            .get(route("teams.task-templates.index", teamSlug))
            .then(({ data }) => {
                setTaskTemplates(data as TaskTemplate[]);
            });
    };

    const handleDeleteTaskTemplate = (templateId: string) => {
        axios
            .delete(
                route("teams.task-templates.destroy", [teamSlug, templateId]),
            )
            .then(() => {
                setTaskTemplates((prev) =>
                    prev.filter((template) => template.id !== templateId),
                );
            });
    };

    const handleCreateTaskTemplate = () => {
        if (!templateFormData.name.trim()) {
            setTemplateFormErrors({ name: "Name is required." });
            return;
        }

        setSavingTaskTemplate(true);
        setTemplateFormErrors({});

        router.post(
            route("teams.task-templates.store", teamSlug),
            {
                name: templateFormData.name,
                description_template:
                    templateFormData.description_template || undefined,
                priority: templateFormData.priority,
                effort_estimate:
                    templateFormData.effort_estimate === ""
                        ? undefined
                        : Number(templateFormData.effort_estimate),
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSavingTaskTemplate(false);
                    resetTemplateForm();
                    void fetchTemplates();
                },
                onError: (errors) => {
                    setTemplateFormErrors(errors as Record<string, string>);
                    setSavingTaskTemplate(false);
                },
            },
        );
    };

    return {
        loadingTemplates,
        savingTaskTemplate,
        showTemplateForm,
        taskTemplates,
        templateFormData,
        templateFormErrors,
        handleCreateTaskTemplate,
        handleDeleteTaskTemplate,
        handleTemplateFieldChange,
        openTemplateForm: () => setShowTemplateForm(true),
        resetTemplateForm,
    };
}
