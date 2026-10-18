using Moq;
using ReservationService.Models;
using ReservationService.Repositories;
using ReservationService.Services;

namespace CinnamonBistro.UnitTests.Reservation;

/// <summary>
/// Unit tests for <see cref="ReservationRescheduleService"/>.
/// Validates reschedule delegation, outcome propagation (Updated, NotFound, Forbidden,
/// InvalidState, TableNotFound, Unavailable), Admin vs Customer command structures,
/// parameter forwarding, CancellationToken propagation, and exception handling.
/// </summary>
public class ReservationRescheduleServiceTests
{
    private readonly Mock<IReservationRepository> _repository = new();
    private readonly ReservationRescheduleService _sut;

    public ReservationRescheduleServiceTests()
    {
        _sut = new ReservationRescheduleService(_repository.Object);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RescheduleAsync — Valid Request & Successful Reschedule
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RescheduleAsync_ValidRequestAndSuccessfulUpdate_ReturnsUpdatedResultAndForwardsParameters()
    {
        using var cts = new CancellationTokenSource();
        var token = cts.Token;
        var period = new AvailabilitySearchCriteria(new DateTime(2026, 10, 20, 19, 0, 0), new DateTime(2026, 10, 20, 20, 30, 0), 4);
        var command = new ReservationRescheduleCommand(
            ReservationId: 105,
            ActorUserId: 12,
            IsAdmin: false,
            TableId: 4,
            Period: period);

        var updatedReservation = new ReservationService.Models.Reservation
        {
            Id = 105,
            CustomerId = 12,
            TableId = 4,
            StartDateTime = period.RequestedStart,
            EndDateTime = period.RequestedEnd,
            GuestCount = period.GuestCount,
            Status = ReservationStatus.Confirmed,
            BookingReference = "CB-RES-105"
        };
        var expected = new ReservationRescheduleResult(ReservationRescheduleOutcome.Updated, updatedReservation);

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, token))
            .ReturnsAsync(expected);

        var result = await _sut.RescheduleAsync(command, token);

        Assert.Same(expected, result);
        Assert.Equal(ReservationRescheduleOutcome.Updated, result.Outcome);
        Assert.Equal("CB-RES-105", result.Reservation?.BookingReference);
        Assert.Equal(4, result.Reservation?.TableId);
        _repository.Verify(r => r.RescheduleAtomicallyAsync(command, token), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RescheduleAsync — Outcome Propagation Across All Domain Outcomes
    // ─────────────────────────────────────────────────────────────────────────────

    [Theory]
    [InlineData(ReservationRescheduleOutcome.NotFound)]
    [InlineData(ReservationRescheduleOutcome.Forbidden)]
    [InlineData(ReservationRescheduleOutcome.InvalidState)]
    [InlineData(ReservationRescheduleOutcome.TableNotFound)]
    [InlineData(ReservationRescheduleOutcome.Unavailable)]
    public async Task RescheduleAsync_NonUpdatedOutcomes_PropagatesResultWithoutModification(ReservationRescheduleOutcome outcome)
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 201,
            ActorUserId: 5,
            IsAdmin: false,
            TableId: 2,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 22, 18, 0, 0), new DateTime(2026, 10, 22, 19, 30, 0), 2));

        var expected = new ReservationRescheduleResult(outcome);
        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var result = await _sut.RescheduleAsync(command);

        Assert.Same(expected, result);
        Assert.Equal(outcome, result.Outcome);
        Assert.Null(result.Reservation);
        _repository.Verify(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RescheduleAsync — Admin vs Customer Command Differentiation
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RescheduleAsync_AdminActorCommand_ForwardsAdminFlagAndPrivilegedParameters()
    {
        var period = new AvailabilitySearchCriteria(new DateTime(2026, 10, 21, 12, 0, 0), new DateTime(2026, 10, 21, 13, 30, 0), 6);
        var adminCommand = new ReservationRescheduleCommand(
            ReservationId: 301,
            ActorUserId: 1, // Admin user ID
            IsAdmin: true,
            TableId: 8,
            Period: period);

        _repository.Setup(r => r.RescheduleAtomicallyAsync(It.IsAny<ReservationRescheduleCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.Updated));

        await _sut.RescheduleAsync(adminCommand);

        _repository.Verify(r => r.RescheduleAtomicallyAsync(
            It.Is<ReservationRescheduleCommand>(c =>
                c.ReservationId == 301 &&
                c.ActorUserId == 1 &&
                c.IsAdmin == true &&
                c.TableId == 8 &&
                c.Period == period),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task RescheduleAsync_CustomerActorCommand_ForwardsCustomerOwnershipParameters()
    {
        var period = new AvailabilitySearchCriteria(new DateTime(2026, 10, 21, 20, 0, 0), new DateTime(2026, 10, 21, 21, 30, 0), 2);
        var customerCommand = new ReservationRescheduleCommand(
            ReservationId: 302,
            ActorUserId: 88, // Customer user ID
            IsAdmin: false,
            TableId: 1,
            Period: period);

        _repository.Setup(r => r.RescheduleAtomicallyAsync(It.IsAny<ReservationRescheduleCommand>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.Updated));

        await _sut.RescheduleAsync(customerCommand);

        _repository.Verify(r => r.RescheduleAtomicallyAsync(
            It.Is<ReservationRescheduleCommand>(c =>
                c.ReservationId == 302 &&
                c.ActorUserId == 88 &&
                c.IsAdmin == false &&
                c.TableId == 1 &&
                c.Period == period),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RescheduleAsync — Business Conflict & Restriction Scenarios
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RescheduleAsync_OverlappingBookingConflictOnTable_SurfacesUnavailableOutcome()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 401,
            ActorUserId: 15,
            IsAdmin: false,
            TableId: 3,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 25, 18, 0, 0), new DateTime(2026, 10, 25, 19, 30, 0), 4));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.Unavailable));

        var result = await _sut.RescheduleAsync(command);

        Assert.Equal(ReservationRescheduleOutcome.Unavailable, result.Outcome);
        Assert.Null(result.Reservation);
    }

    [Fact]
    public async Task RescheduleAsync_TableCapacityExceededOrInactive_SurfacesUnavailableOutcome()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 402,
            ActorUserId: 15,
            IsAdmin: false,
            TableId: 2, // 2-seater table requested for 8 guests
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 25, 18, 0, 0), new DateTime(2026, 10, 25, 19, 30, 0), 8));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.Unavailable));

        var result = await _sut.RescheduleAsync(command);

        Assert.Equal(ReservationRescheduleOutcome.Unavailable, result.Outcome);
    }

    [Fact]
    public async Task RescheduleAsync_TableDoesNotExist_SurfacesTableNotFoundOutcome()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 403,
            ActorUserId: 15,
            IsAdmin: false,
            TableId: 9999, // Non-existent table
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 25, 18, 0, 0), new DateTime(2026, 10, 25, 19, 30, 0), 2));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.TableNotFound));

        var result = await _sut.RescheduleAsync(command);

        Assert.Equal(ReservationRescheduleOutcome.TableNotFound, result.Outcome);
    }

    [Fact]
    public async Task RescheduleAsync_ReservationInTerminalOrInvalidState_SurfacesInvalidStateOutcome()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 404,
            ActorUserId: 15,
            IsAdmin: false,
            TableId: 3,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 25, 18, 0, 0), new DateTime(2026, 10, 25, 19, 30, 0), 2));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.InvalidState));

        var result = await _sut.RescheduleAsync(command);

        Assert.Equal(ReservationRescheduleOutcome.InvalidState, result.Outcome);
    }

    [Fact]
    public async Task RescheduleAsync_ReservationNotFoundOrBelongsToOtherCustomer_SurfacesNotFoundOutcome()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 405,
            ActorUserId: 99,
            IsAdmin: false,
            TableId: 3,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 25, 18, 0, 0), new DateTime(2026, 10, 25, 19, 30, 0), 2));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.NotFound));

        var result = await _sut.RescheduleAsync(command);

        Assert.Equal(ReservationRescheduleOutcome.NotFound, result.Outcome);
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RescheduleAsync — CancellationToken & Exception Propagation
    // ─────────────────────────────────────────────────────────────────────────────

    [Fact]
    public async Task RescheduleAsync_CancellationTokenProvided_ForwardsTokenToRepository()
    {
        using var cts = new CancellationTokenSource();
        var token = cts.Token;
        var command = new ReservationRescheduleCommand(
            ReservationId: 501,
            ActorUserId: 10,
            IsAdmin: false,
            TableId: 1,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 28, 12, 0, 0), new DateTime(2026, 10, 28, 13, 0, 0), 2));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(command, token))
            .ReturnsAsync(new ReservationRescheduleResult(ReservationRescheduleOutcome.Updated));

        await _sut.RescheduleAsync(command, token);

        _repository.Verify(r => r.RescheduleAtomicallyAsync(command, token), Times.Once);
    }

    [Fact]
    public async Task RescheduleAsync_RepositoryThrowsInvalidOperationException_ExceptionIsNotSwallowed()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 601,
            ActorUserId: 10,
            IsAdmin: false,
            TableId: 1,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 28, 12, 0, 0), new DateTime(2026, 10, 28, 13, 0, 0), 2));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(It.IsAny<ReservationRescheduleCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("Failed to acquire lock for table"));

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() => _sut.RescheduleAsync(command));

        Assert.Equal("Failed to acquire lock for table", ex.Message);
    }

    [Fact]
    public async Task RescheduleAsync_RepositoryThrowsTimeoutException_ExceptionIsNotSwallowed()
    {
        var command = new ReservationRescheduleCommand(
            ReservationId: 602,
            ActorUserId: 10,
            IsAdmin: false,
            TableId: 1,
            Period: new AvailabilitySearchCriteria(new DateTime(2026, 10, 28, 12, 0, 0), new DateTime(2026, 10, 28, 13, 0, 0), 2));

        _repository.Setup(r => r.RescheduleAtomicallyAsync(It.IsAny<ReservationRescheduleCommand>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new TimeoutException("Database connection timeout during reschedule transaction"));

        var ex = await Assert.ThrowsAsync<TimeoutException>(() => _sut.RescheduleAsync(command));

        Assert.Equal("Database connection timeout during reschedule transaction", ex.Message);
    }
}
