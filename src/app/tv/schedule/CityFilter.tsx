'use client'

/** City filter for the schedule: a plain GET form that also submits as soon as the choice changes. */
export function CityFilter({ cities, city, date }: { cities: string[]; city: string | null; date: string }) {
  return (
    <form className="schedule-filter" method="get" action="/tv/schedule">
      <input type="hidden" name="date" value={date} />
      <label htmlFor="city">City</label>
      <select id="city" name="city" defaultValue={city ?? ''} onChange={(e) => e.currentTarget.form?.requestSubmit()}>
        <option value="">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <noscript>
        <button className="btn btn-ghost btn-sm" type="submit">
          Apply
        </button>
      </noscript>
    </form>
  )
}
