namespace CinnamonBistro.UnitTests.Support;

/// <summary>Deterministic <see cref="TimeProvider"/> that always reports the same instant.</summary>
public sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => utcNow;
}
