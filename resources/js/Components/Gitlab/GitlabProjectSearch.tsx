import { useState, useCallback } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

interface GitlabSearchResult {
    id: number;
    name: string;
    path_with_namespace: string;
    web_url: string;
    default_branch: string;
}

interface Props {
    connectionId: string;
    teamId: string;
    onSelect: (project: GitlabSearchResult) => void;
}

export default function GitlabProjectSearch({ connectionId, teamId, onSelect }: Props) {
    const [options, setOptions] = useState<GitlabSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputValue, setInputValue] = useState('');

    const debounceRef = { timer: null as ReturnType<typeof setTimeout> | null };

    const search = useCallback(
        (query: string) => {
            if (debounceRef.timer) clearTimeout(debounceRef.timer);

            if (query.length < 2) {
                setOptions([]);
                return;
            }

            debounceRef.timer = setTimeout(async () => {
                setLoading(true);
                try {
                    const params = new URLSearchParams({
                        connection_id: connectionId,
                        q: query,
                    });
                    const response = await fetch(
                        route('teams.gitlab-projects.search', teamId) + '?' + params.toString(),
                        {
                            headers: {
                                Accept: 'application/json',
                                'X-Requested-With': 'XMLHttpRequest',
                            },
                        },
                    );
                    if (response.ok) {
                        const data = await response.json();
                        setOptions(data);
                    }
                } catch {
                    setOptions([]);
                } finally {
                    setLoading(false);
                }
            }, 400);
        },
        [connectionId, teamId],
    );

    return (
        <Autocomplete
            options={options}
            loading={loading}
            inputValue={inputValue}
            onInputChange={(_e, value) => {
                setInputValue(value);
                search(value);
            }}
            onChange={(_e, value) => {
                if (value) {
                    onSelect(value);
                    setInputValue('');
                    setOptions([]);
                }
            }}
            getOptionLabel={(option) => option.path_with_namespace}
            renderOption={({ key, ...props }, option) => (
                <li key={key} {...props}>
                    <div>
                        <Typography variant="body2" fontWeight={500}>
                            {option.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {option.path_with_namespace}
                        </Typography>
                    </div>
                </li>
            )}
            renderInput={(params) => (
                <TextField
                    {...params}
                    label="Search GitLab projects"
                    placeholder="Type to search..."
                    slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {loading && <CircularProgress size={20} />}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        },
                    }}
                />
            )}
            noOptionsText={inputValue.length < 2 ? 'Type at least 2 characters' : 'No projects found'}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            filterOptions={(x) => x}
        />
    );
}
