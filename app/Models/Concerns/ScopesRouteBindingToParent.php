<?php

namespace App\Models\Concerns;

trait ScopesRouteBindingToParent
{
    /**
     * The parent route binding configuration:
     * [route parameter name, parent model class, foreign key column].
     *
     * @return array{0: string, 1: class-string, 2: string}
     */
    abstract protected function parentRouteBinding(): array;

    public function resolveRouteBinding($value, $field = null): ?self
    {
        [$parameter, $parentClass, $foreignKey] = $this->parentRouteBinding();

        $query = $this->newQuery();

        // Scope to the parent model if resolved in the route
        $parent = request()->route($parameter);
        if ($parent instanceof $parentClass) {
            $query->where($foreignKey, $parent->id);
        }

        return $field
            ? $query->where($field, $value)->first()
            : $query->where('id', $value)->first();
    }
}
