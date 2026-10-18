using ReservationService.Models;

namespace CinnamonBistro.UnitTests.Reservation;

/// <summary>Pure-function tests for the reservation overlap and status-transition policies.</summary>
public class ReservationPoliciesTests
{
    private static readonly DateTime Base = new(2026, 10, 19, 18, 0, 0);

    private static DateTime At(int minutes) => Base.AddMinutes(minutes);

    // ---------- ReservationOverlapPolicy.Blocks (half-open interval [start, end)) ----------
    // Existing booking is always 0..60 minutes after 18:00; requested interval is varied.

    [Theory]
    [InlineData(0, 60, true)]     // identical interval
    [InlineData(30, 90, true)]    // requested starts inside existing
    [InlineData(-30, 30, true)]   // requested ends inside existing
    [InlineData(10, 20, true)]    // requested wholly inside existing
    [InlineData(-30, 120, true)]  // requested wholly contains existing
    [InlineData(59, 120, true)]   // one-minute overlap at the tail
    [InlineData(-60, 1, true)]    // one-minute overlap at the head
    [InlineData(60, 120, false)]  // back-to-back: requested starts exactly when existing ends
    [InlineData(-60, 0, false)]   // back-to-back: requested ends exactly when existing starts
    [InlineData(120, 180, false)] // clearly after
    [InlineData(-180, -120, false)] // clearly before
    public void Blocks_ActiveBooking_FollowsHalfOpenOverlapRule(int reqStart, int reqEnd, bool expected)
    {
        var blocks = ReservationOverlapPolicy.Blocks(At(0), At(60), At(reqStart), At(reqEnd), ReservationStatus.Confirmed);

        Assert.Equal(expected, blocks);
    }

    [Theory]
    [InlineData(ReservationStatus.Pending, true)]
    [InlineData(ReservationStatus.Confirmed, true)]
    [InlineData(ReservationStatus.Cancelled, false)]
    [InlineData(ReservationStatus.Completed, false)]
    [InlineData("Unknown", false)]
    [InlineData("", false)]
    public void Blocks_OverlappingInterval_OnlyPendingAndConfirmedBookingsBlock(string status, bool expected)
    {
        var blocks = ReservationOverlapPolicy.Blocks(At(0), At(60), At(30), At(90), status);

        Assert.Equal(expected, blocks);
    }

    // ---------- ReservationStatusTransitionPolicy.IsAllowed ----------

    [Theory]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Confirmed)]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Completed)]
    public void IsAllowed_DocumentedLifecycleTransitions_AreAccepted(string from, string to)
    {
        Assert.True(ReservationStatusTransitionPolicy.IsAllowed(from, to));
    }

    [Theory]
    [InlineData(ReservationStatus.Pending, ReservationStatus.Completed)]   // cannot skip confirmation
    [InlineData(ReservationStatus.Pending, ReservationStatus.Pending)]     // no self-transition
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Pending)]   // cannot go backwards
    [InlineData(ReservationStatus.Confirmed, ReservationStatus.Confirmed)]
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.Confirmed)] // terminal state
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.Pending)]
    [InlineData(ReservationStatus.Cancelled, ReservationStatus.Completed)]
    [InlineData(ReservationStatus.Completed, ReservationStatus.Cancelled)] // terminal state
    [InlineData(ReservationStatus.Completed, ReservationStatus.Confirmed)]
    [InlineData("Bogus", ReservationStatus.Confirmed)]
    [InlineData(ReservationStatus.Pending, "Bogus")]
    public void IsAllowed_AnyOtherTransition_IsRejected(string from, string to)
    {
        Assert.False(ReservationStatusTransitionPolicy.IsAllowed(from, to));
    }

    [Theory]
    [InlineData(ReservationStatus.Cancelled)]
    [InlineData(ReservationStatus.Completed)]
    public void IsAllowed_TerminalStatus_CanNeverMoveToAnyKnownStatus(string terminal)
    {
        var all = new[] { ReservationStatus.Pending, ReservationStatus.Confirmed, ReservationStatus.Cancelled, ReservationStatus.Completed };

        Assert.All(all, target => Assert.False(ReservationStatusTransitionPolicy.IsAllowed(terminal, target)));
    }
}
